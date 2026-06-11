import { MongoClient, Db, Collection } from "mongodb";
import type {
  AnalyticsAdapter,
  GenerationLog,
  BrandCache,
  LayoutExample,
  SectionTemplate,
  UserFeedback,
  ComponentEngineAdapter,
  CrawlTarget,
  RawSectionDoc,
  AnimationPatternRecord,
} from "./interface.js";

const DB_NAME = "atelier";

export class MongoAnalytics implements AnalyticsAdapter, ComponentEngineAdapter {
  private client: MongoClient;
  private db!: Db;
  private generationLogs!: Collection;
  private brandCache!: Collection;
  private layoutExamples!: Collection;
  private sectionTemplates!: Collection;
  private userFeedback!: Collection;
  private eloMatches!: Collection;
  // Component Engine collections
  private crawlTargets!: Collection;
  private rawSections!: Collection;
  private animationPatterns!: Collection;

  constructor(uri: string) {
    this.client = new MongoClient(uri, {
      maxPoolSize: 50,
      minPoolSize: 2,
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
  }

  async initialize(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(DB_NAME);

    this.generationLogs = this.db.collection("generation_logs");
    this.brandCache = this.db.collection("brand_cache");
    this.layoutExamples = this.db.collection("layout_examples");
    this.sectionTemplates = this.db.collection("section_templates");
    this.userFeedback = this.db.collection("user_feedback");
    this.eloMatches = this.db.collection("elo_matches");
    // Component Engine
    this.crawlTargets = this.db.collection("crawl_targets");
    this.rawSections = this.db.collection("raw_sections");
    this.animationPatterns = this.db.collection("animation_patterns");

    await this._ensureIndexes();
    console.log("[mongo] connected to Atlas, database:", DB_NAME);
  }

  async close(): Promise<void> {
    await this.client.close();
    console.log("[mongo] connection closed");
  }

  // ─── Generation Logs ───

  async logGeneration(data: GenerationLog): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await this.generationLogs.insertOne({
      ...data,
      createdAt: new Date(),
      expiresAt,
    });
  }

  // ─── Brand Cache ───

  async getBrandCache(domain: string): Promise<BrandCache | null> {
    const doc = await this.brandCache.findOne({ domain });
    if (!doc) return null;

    // Check staleness — 30 days
    const extractedAt = new Date(doc.extractedAt);
    const staleMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - extractedAt.getTime() > staleMs) {
      console.log(`[mongo] brand cache for ${domain} is stale (>30d), will re-extract`);
      return null;
    }

    // Bump lastUsed and useCount
    await this.brandCache.updateOne(
      { domain },
      { $set: { lastUsed: new Date().toISOString() }, $inc: { useCount: 1 } }
    );

    return {
      domain: doc.domain,
      url: doc.url,
      colors: doc.colors,
      fonts: doc.fonts,
      logoUrl: doc.logoUrl,
      aakerVector: doc.aakerVector,
      personaId: doc.personaId,
      sectionTypes: doc.sectionTypes,
      extractedAt: doc.extractedAt,
      lastUsed: new Date().toISOString(),
      useCount: (doc.useCount || 0) + 1,
    };
  }

  async setBrandCache(domain: string, data: BrandCache): Promise<void> {
    await this.brandCache.updateOne(
      { domain },
      { $set: { ...data, domain, lastUsed: new Date().toISOString() } },
      { upsert: true }
    );
    console.log(`[mongo] cached brand data for ${domain}`);
  }

  // ─── Layout Examples ───

  async getLayoutExamples(industry: string, pageType: string, limit = 3): Promise<LayoutExample[]> {
    const docs = await this.layoutExamples
      .find({ industry, pageType })
      .sort({ compositeScore: -1, qualityScore: -1 })
      .limit(limit)
      .toArray();

    return docs.map((d) => ({
      industry: d.industry,
      pageType: d.pageType,
      sectionSequence: d.sectionSequence,
      sectionCount: d.sectionCount,
      metadata: d.metadata,
      sections: d.sections,
      qualityScore: d.qualityScore,
      positiveRatings: d.positiveRatings ?? 0,
      negativeRatings: d.negativeRatings ?? 0,
      compositeScore: d.compositeScore ?? d.qualityScore,
      embedding: d.embedding,
    }));
  }

  async saveLayoutExample(data: LayoutExample): Promise<void> {
    await this.layoutExamples.insertOne({
      ...data,
      createdAt: new Date(),
    });
  }

  // ─── Section Templates ───

  async getSectionTemplates(type: string, industry?: string, limit = 2): Promise<SectionTemplate[]> {
    const filter: Record<string, unknown> = { type };
    if (industry) filter.industry = industry;

    // Fetch extra candidates for Thompson Sampling exploration
    const fetchLimit = Math.max(limit * 3, 10);
    const docs = await this.sectionTemplates
      .find(filter)
      .sort({ compositeScore: -1, qualityScore: -1, timesReused: -1 })
      .limit(fetchLimit)
      .toArray();

    const mapped = docs.map((d) => ({
      type: d.type,
      industry: d.industry,
      style: d.style,
      html: d.html,
      htmlLength: d.htmlLength,
      features: d.features,
      qualityScore: d.qualityScore,
      positiveRatings: d.positiveRatings ?? 0,
      negativeRatings: d.negativeRatings ?? 0,
      compositeScore: d.compositeScore ?? d.qualityScore,
      elo: d.elo ?? { rating: 1500, matches: 0, wins: 0, sigma: 350 },
      timesReused: d.timesReused,
      sourceGenerationId: d.sourceGenerationId,
    }) as SectionTemplate);

    // Use Thompson Sampling to select from candidates (explore/exploit)
    if (mapped.length > limit) {
      const { thompsonSelect } = await import("../utils/rating.js");
      return thompsonSelect(mapped, limit);
    }
    return mapped;
  }

  async saveSectionTemplate(data: SectionTemplate): Promise<void> {
    // Deduplicate by type + htmlLength (rough check — exact dedup uses hash in Phase 4)
    const existing = await this.sectionTemplates.findOne({
      type: data.type,
      htmlLength: data.htmlLength,
    });
    if (existing) {
      // Bump reuse count instead of inserting duplicate
      await this.sectionTemplates.updateOne(
        { _id: existing._id },
        { $inc: { timesReused: 1 }, $set: { updatedAt: new Date() } }
      );
      return;
    }

    await this.sectionTemplates.insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // ─── User Feedback ───

  async logFeedback(data: UserFeedback): Promise<void> {
    await this.userFeedback.insertOne({
      ...data,
      createdAt: new Date(),
    });
  }

  // ─── Quality Score Adjustment ───

  async adjustTemplateScores(action: "exported" | "kept" | "deleted" | "edited" | "variant_created", recentMinutes = 10): Promise<number> {
    // Boost or penalize templates created in the last N minutes
    // Positive actions: exported (+1), kept (+0.5), variant_created (+0.3), edited (+0.2)
    // Negative: deleted (-0.5)
    const scoreMap: Record<string, number> = {
      exported: 1,
      kept: 0.5,
      variant_created: 0.3,
      edited: 0.2,
      deleted: -0.5,
    };
    const delta = scoreMap[action] ?? 0;
    if (delta === 0) return 0;

    const since = new Date(Date.now() - recentMinutes * 60 * 1000);
    const result = await this.sectionTemplates.updateMany(
      { createdAt: { $gte: since } },
      { $inc: { qualityScore: delta }, $set: { updatedAt: new Date() } },
    );
    const modified = result.modifiedCount;
    if (modified > 0) {
      console.log(`[mongo] Adjusted ${modified} template scores by ${delta > 0 ? "+" : ""}${delta} (action: ${action})`);
      // Recalculate compositeScore for affected templates
      const docs = await this.sectionTemplates.find({ createdAt: { $gte: since } }).toArray();
      for (const d of docs) {
        const pos = d.positiveRatings ?? 0;
        const neg = d.negativeRatings ?? 0;
        const total = pos + neg;
        const wilson = total > 0 ? this._wilsonLower(pos, total) : 0.5;
        const confidence = Math.min(1.0, total / 20);
        const wAuto = 1.0 - confidence * 0.6;
        const wHuman = confidence * 0.6;
        const composite = Math.round((wAuto * ((d.qualityScore ?? 3) / 10) + wHuman * wilson) * 100) / 10;
        await this.sectionTemplates.updateOne({ _id: d._id }, { $set: { compositeScore: composite } });
      }
    }
    return modified;
  }

  // ─── Section Rating ───

  async rateSectionTemplate(sectionType: string, vote: "up" | "down", recentMinutes = 10): Promise<number> {
    const since = new Date(Date.now() - recentMinutes * 60 * 1000);
    const field = vote === "up" ? "positiveRatings" : "negativeRatings";
    const result = await this.sectionTemplates.updateMany(
      { type: sectionType, createdAt: { $gte: since } },
      { $inc: { [field]: 1 }, $set: { updatedAt: new Date() } },
    );
    if (result.modifiedCount > 0) {
      // Recalculate compositeScore for affected templates
      const docs = await this.sectionTemplates
        .find({ type: sectionType, createdAt: { $gte: since } })
        .toArray();
      for (const d of docs) {
        const pos = d.positiveRatings ?? 0;
        const neg = d.negativeRatings ?? 0;
        const total = pos + neg;
        const wilson = total > 0 ? this._wilsonLower(pos, total) : 0.5;
        const confidence = Math.min(1.0, total / 20);
        const wAuto = 1.0 - confidence * 0.6;
        const wHuman = confidence * 0.6;
        const composite = Math.round((wAuto * ((d.qualityScore ?? 3) / 10) + wHuman * wilson) * 100) / 10;
        await this.sectionTemplates.updateOne(
          { _id: d._id },
          { $set: { compositeScore: composite } },
        );
      }
    }
    return result.modifiedCount;
  }

  private _wilsonLower(positive: number, total: number, z = 1.96): number {
    if (total === 0) return 0;
    const p = positive / total;
    const denom = 1 + z * z / total;
    const centre = p + z * z / (2 * total);
    const spread = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total);
    return (centre - spread) / denom;
  }

  // ─── ELO Pairwise Comparison ───

  async submitEloComparison(winnerId: string, loserId: string, outcome: "win" | "draw", sectionType: string): Promise<void> {
    const { ObjectId } = await import("mongodb");
    const winDoc = await this.sectionTemplates.findOne({ _id: new ObjectId(winnerId) });
    const loseDoc = await this.sectionTemplates.findOne({ _id: new ObjectId(loserId) });
    if (!winDoc || !loseDoc) throw new Error("Template not found");

    const winElo = winDoc.elo ?? { rating: 1500, matches: 0, wins: 0, sigma: 350 };
    const loseElo = loseDoc.elo ?? { rating: 1500, matches: 0, wins: 0, sigma: 350 };

    // Import ELO functions
    const { updateElo, updateEloDraw } = await import("../utils/rating.js");

    if (outcome === "draw") {
      const result = updateEloDraw(winElo, loseElo);
      await this.sectionTemplates.updateOne({ _id: new ObjectId(winnerId) }, { $set: { elo: result.a, updatedAt: new Date() } });
      await this.sectionTemplates.updateOne({ _id: new ObjectId(loserId) }, { $set: { elo: result.b, updatedAt: new Date() } });
    } else {
      const result = updateElo(winElo, loseElo);
      await this.sectionTemplates.updateOne({ _id: new ObjectId(winnerId) }, { $set: { elo: result.winner, updatedAt: new Date() } });
      await this.sectionTemplates.updateOne({ _id: new ObjectId(loserId) }, { $set: { elo: result.loser, updatedAt: new Date() } });
    }

    // Audit trail
    await this.eloMatches.insertOne({
      winnerId, loserId, outcome, sectionType,
      winnerRatingBefore: winElo.rating,
      loserRatingBefore: loseElo.rating,
      createdAt: new Date(),
    });
  }

  async getEloPair(sectionType: string): Promise<{ a: any; b: any } | null> {
    // Get templates of this type with HTML (need content to render)
    const pool = await this.sectionTemplates
      .find({ type: sectionType, html: { $exists: true } })
      .sort({ "elo.matches": 1 }) // Least-compared first
      .limit(20)
      .toArray();

    if (pool.length < 2) return null;

    // Pick most uncertain (fewest matches)
    const uncertain = pool[0];
    // Find closest ELO opponent
    const others = pool.filter(d => !d._id.equals(uncertain._id));
    others.sort((a, b) =>
      Math.abs((a.elo?.rating ?? 1500) - (uncertain.elo?.rating ?? 1500)) -
      Math.abs((b.elo?.rating ?? 1500) - (uncertain.elo?.rating ?? 1500))
    );
    const opponent = others[0];

    const map = (d: any) => ({
      _id: d._id.toString(),
      type: d.type,
      style: d.style,
      html: d.html,
      elo: d.elo ?? { rating: 1500, matches: 0, wins: 0, sigma: 350 },
    });

    // Randomize left/right
    return Math.random() < 0.5
      ? { a: map(uncertain), b: map(opponent) }
      : { a: map(opponent), b: map(uncertain) };
  }

  async getEloLeaderboard(sectionType: string, limit = 10): Promise<Array<{ _id: string; type: string; style?: string; rating: number; matches: number; wins: number; htmlSnippet: string }>> {
    const docs = await this.sectionTemplates
      .find({ type: sectionType, "elo.matches": { $gt: 0 } })
      .sort({ "elo.rating": -1 })
      .limit(limit)
      .toArray();

    return docs.map(d => ({
      _id: d._id.toString(),
      type: d.type,
      style: d.style,
      rating: Math.round(d.elo?.rating ?? 1500),
      matches: d.elo?.matches ?? 0,
      wins: d.elo?.wins ?? 0,
      htmlSnippet: (d.html || "").slice(0, 200),
    }));
  }

  async getSectionTypes(): Promise<Array<{ type: string; count: number }>> {
    const result = await this.sectionTemplates.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();
    return result.map(r => ({ type: r._id as string, count: r.count as number }));
  }

  // ─── Quality Summary & Trends ───

  async getQualitySummary(): Promise<import("./interface.js").QualitySummary> {
    // Average composite score across all templates
    const scoreAgg = await this.sectionTemplates.aggregate([
      { $group: { _id: null, avg: { $avg: "$compositeScore" }, count: { $sum: 1 } } },
    ]).toArray();
    const avgCompositeScore = Math.round((scoreAgg[0]?.avg ?? 3) * 10) / 10;
    const totalTemplates = scoreAgg[0]?.count ?? 0;

    // Average explicit page rating
    const ratingAgg = await this.userFeedback.aggregate([
      { $match: { explicitRating: { $ne: null, $exists: true } } },
      { $group: { _id: null, avg: { $avg: "$explicitRating" }, count: { $sum: 1 } } },
    ]).toArray();
    const avgPageRating = ratingAgg[0] ? Math.round(ratingAgg[0].avg * 10) / 10 : null;

    // Best and worst section types by avg composite score
    const typeScores = await this.sectionTemplates.aggregate([
      { $group: { _id: "$type", avg: { $avg: "$compositeScore" }, count: { $sum: 1 } } },
      { $match: { count: { $gte: 3 } } }, // min 3 templates to be meaningful
      { $sort: { avg: -1 } },
    ]).toArray();
    const bestSectionType = typeScores.length > 0
      ? { type: typeScores[0]._id as string, score: Math.round(typeScores[0].avg * 10) / 10 }
      : null;
    const worstSectionType = typeScores.length > 1
      ? { type: typeScores[typeScores.length - 1]._id as string, score: Math.round(typeScores[typeScores.length - 1].avg * 10) / 10 }
      : null;

    // Totals
    const totalEloMatches = await this.eloMatches.estimatedDocumentCount();
    const totalFeedback = await this.userFeedback.estimatedDocumentCount();

    // 7-day trend: compare avg composite now vs 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldAgg = await this.sectionTemplates.aggregate([
      { $match: { updatedAt: { $lte: sevenDaysAgo } } },
      { $group: { _id: null, avg: { $avg: "$compositeScore" } } },
    ]).toArray();
    const ratingTrend7d = oldAgg[0] ? Math.round((avgCompositeScore - oldAgg[0].avg) * 10) / 10 : null;

    return { avgCompositeScore, avgPageRating, bestSectionType, worstSectionType, totalTemplates, totalEloMatches, totalFeedback, ratingTrend7d };
  }

  async getRatingTrends(days = 30): Promise<import("./interface.js").RatingTrend[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Daily feedback counts
    const feedbackByDay = await this.userFeedback.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray();

    // Daily ELO match counts
    const eloByDay = await this.eloMatches.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray();

    // Current averages (snapshot — not per-day historical, since templates are mutable)
    const currentAvg = await this.sectionTemplates.aggregate([
      { $group: { _id: null, avgComposite: { $avg: "$compositeScore" }, avgElo: { $avg: "$elo.rating" } } },
    ]).toArray();
    const avgComposite = currentAvg[0]?.avgComposite ?? 3;
    const avgElo = currentAvg[0]?.avgElo ?? 1500;

    // Build day-by-day results
    const feedbackMap = new Map(feedbackByDay.map(r => [r._id as string, r.count as number]));
    const eloMap = new Map(eloByDay.map(r => [r._id as string, r.count as number]));

    const results: import("./interface.js").RatingTrend[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      results.push({
        date: key,
        avgCompositeScore: Math.round(avgComposite * 10) / 10,
        avgEloRating: Math.round(avgElo),
        feedbackCount: feedbackMap.get(key) ?? 0,
        eloMatchCount: eloMap.get(key) ?? 0,
      });
    }
    return results;
  }

  async applyEloDecay(staleDays = 60): Promise<number> {
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
    const result = await this.sectionTemplates.updateMany(
      {
        updatedAt: { $lt: cutoff },
        "elo.sigma": { $lt: 300 },
        "elo.matches": { $gt: 0 },
      },
      [{ $set: { "elo.sigma": { $min: [350, { $multiply: ["$elo.sigma", 1.5] }] } } }],
    );
    if (result.modifiedCount > 0) {
      console.log(`[mongo] ELO decay: increased sigma for ${result.modifiedCount} stale templates (>${staleDays}d)`);
    }
    return result.modifiedCount;
  }

  // ─── Component Engine: Crawl Targets ───

  async saveCrawlTarget(target: CrawlTarget): Promise<void> {
    await this.crawlTargets.updateOne(
      { domain: target.domain },
      { $set: { ...target, updatedAt: new Date() } },
      { upsert: true },
    );
  }

  async getCrawlTarget(domain: string): Promise<CrawlTarget | null> {
    const doc = await this.crawlTargets.findOne({ domain });
    if (!doc) return null;
    return {
      url: doc.url, domain: doc.domain, industry: doc.industry, tier: doc.tier,
      lastCrawled: doc.lastCrawled, crawlCount: doc.crawlCount ?? 0,
      pagesCrawled: doc.pagesCrawled ?? [], sectionsExtracted: doc.sectionsExtracted ?? 0,
      status: doc.status ?? "pending", createdAt: doc.createdAt,
    };
  }

  async listCrawlTargets(filter?: { status?: string; tier?: string; industry?: string }): Promise<CrawlTarget[]> {
    const query: Record<string, unknown> = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.tier) query.tier = filter.tier;
    if (filter?.industry) query.industry = filter.industry;

    const docs = await this.crawlTargets.find(query).sort({ status: 1, domain: 1 }).toArray();
    return docs.map(d => ({
      url: d.url, domain: d.domain, industry: d.industry, tier: d.tier,
      lastCrawled: d.lastCrawled, crawlCount: d.crawlCount ?? 0,
      pagesCrawled: d.pagesCrawled ?? [], sectionsExtracted: d.sectionsExtracted ?? 0,
      status: d.status ?? "pending", createdAt: d.createdAt,
    }));
  }

  async updateCrawlTarget(domain: string, update: Partial<CrawlTarget>): Promise<void> {
    await this.crawlTargets.updateOne({ domain }, { $set: { ...update, updatedAt: new Date() } });
  }

  // ─── Component Engine: Raw Sections ───

  async saveRawSection(section: RawSectionDoc): Promise<string> {
    const result = await this.rawSections.insertOne({
      ...section,
      createdAt: new Date(),
    });
    return result.insertedId.toString();
  }

  async getRawSections(
    filter?: { domain?: string; category?: string; tier?: string; status?: string },
    limit = 50,
  ): Promise<Array<RawSectionDoc & { _id: string }>> {
    const query: Record<string, unknown> = {};
    if (filter?.domain) query.sourceDomain = filter.domain;
    if (filter?.category) query["classification.category"] = filter.category;
    if (filter?.tier) query["classification.tier"] = filter.tier;
    if (filter?.status) query.status = filter.status;

    const docs = await this.rawSections.find(query).sort({ extractedAt: -1 }).limit(limit).toArray();
    return docs.map(d => ({
      _id: d._id.toString(),
      sourceUrl: d.sourceUrl, sourceDomain: d.sourceDomain, industry: d.industry,
      html: d.html, htmlLength: d.htmlLength, textContent: d.textContent,
      visualHash: d.visualHash, classification: d.classification,
      animations: d.animations ?? [], animationBrief: d.animationBrief,
      structuralHash: d.structuralHash, status: d.status ?? "raw",
      extractedAt: d.extractedAt,
    }));
  }

  async updateRawSectionStatus(id: string, status: RawSectionDoc["status"]): Promise<void> {
    const { ObjectId } = await import("mongodb");
    await this.rawSections.updateOne({ _id: new ObjectId(id) }, { $set: { status, updatedAt: new Date() } });
  }

  async updateRawSectionBrief(id: string, brief: RawSectionDoc["animationBrief"]): Promise<void> {
    const { ObjectId } = await import("mongodb");
    await this.rawSections.updateOne(
      { _id: new ObjectId(id) },
      { $set: { animationBrief: brief, status: "briefed", updatedAt: new Date() } },
    );
  }

  // ─── Component Engine: Animation Patterns ───

  async upsertAnimationPattern(record: AnimationPatternRecord): Promise<void> {
    const key = { domain: record.domain, "pattern.type": record.pattern.type, "pattern.trigger": record.pattern.trigger };
    await this.animationPatterns.updateOne(
      key,
      {
        $set: { ...record, lastSeen: new Date().toISOString(), updatedAt: new Date() },
        $inc: { frequency: 1 },
        $setOnInsert: { firstSeen: record.firstSeen, createdAt: new Date() },
        $addToSet: { exampleSectionIds: { $each: record.exampleSectionIds } },
      },
      { upsert: true },
    );
  }

  async getAnimationPatterns(
    filter?: { domain?: string; type?: string },
    limit = 50,
  ): Promise<AnimationPatternRecord[]> {
    const query: Record<string, unknown> = {};
    if (filter?.domain) query.domain = filter.domain;
    if (filter?.type) query["pattern.type"] = filter.type;

    const docs = await this.animationPatterns.find(query).sort({ frequency: -1 }).limit(limit).toArray();
    return docs.map(d => ({
      domain: d.domain, url: d.url, industry: d.industry,
      pattern: d.pattern, frequency: d.frequency ?? 1,
      firstSeen: d.firstSeen, lastSeen: d.lastSeen,
      exampleSectionIds: d.exampleSectionIds ?? [],
    }));
  }

  async getPatternCatalogue(): Promise<Array<{ type: string; trigger: string; frequency: number; domains: number }>> {
    const result = await this.animationPatterns.aggregate([
      { $group: {
        _id: { type: "$pattern.type", trigger: "$pattern.trigger" },
        frequency: { $sum: "$frequency" },
        domains: { $addToSet: "$domain" },
      }},
      { $project: {
        type: "$_id.type", trigger: "$_id.trigger",
        frequency: 1, domains: { $size: "$domains" },
      }},
      { $sort: { frequency: -1 } },
    ]).toArray();
    return result.map(r => ({ type: r.type, trigger: r.trigger, frequency: r.frequency, domains: r.domains }));
  }

  // ─── Component Engine: Stats ───

  async getEngineStats(): Promise<{ crawlTargets: number; rawSections: number; animationPatterns: number; byTier: Record<string, number>; byCategory: Record<string, number> }> {
    const crawlTargets = await this.crawlTargets.estimatedDocumentCount();
    const rawSections = await this.rawSections.estimatedDocumentCount();
    const animationPatternsCount = await this.animationPatterns.estimatedDocumentCount();

    const tierAgg = await this.rawSections.aggregate([
      { $group: { _id: "$classification.tier", count: { $sum: 1 } } },
    ]).toArray();
    const byTier: Record<string, number> = {};
    for (const r of tierAgg) byTier[r._id as string] = r.count;

    const catAgg = await this.rawSections.aggregate([
      { $group: { _id: "$classification.category", count: { $sum: 1 } } },
    ]).toArray();
    const byCategory: Record<string, number> = {};
    for (const r of catAgg) byCategory[r._id as string] = r.count;

    return { crawlTargets, rawSections, animationPatterns: animationPatternsCount, byTier, byCategory };
  }

  // ─── Stats / Monitoring ───

  async getStats(): Promise<{ collections: Record<string, number>; totalDocs: number; estimatedSizeMB: number }> {
    const names = ["generation_logs", "brand_cache", "layout_examples", "section_templates", "user_feedback", "elo_matches", "crawl_targets", "raw_sections", "animation_patterns"];
    const collections: Record<string, number> = {};
    let totalDocs = 0;
    let totalSize = 0;

    for (const name of names) {
      const col = this.db.collection(name);
      const count = await col.estimatedDocumentCount();
      collections[name] = count;
      totalDocs += count;
      try {
        const stats = await this.db.command({ collStats: name });
        totalSize += stats.storageSize || 0;
      } catch {}
    }

    return { collections, totalDocs, estimatedSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100 };
  }

  // ─── Indexes ───

  private async _ensureIndexes(): Promise<void> {
    // generation_logs
    await this.generationLogs.createIndex({ createdAt: -1 });
    await this.generationLogs.createIndex({ pipeline: 1, model: 1 });
    await this.generationLogs.createIndex({ "quality.userRating": 1 });
    await this.generationLogs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

    // brand_cache
    await this.brandCache.createIndex({ domain: 1 }, { unique: true });
    await this.brandCache.createIndex({ lastUsed: 1 });
    await this.brandCache.createIndex({ personaId: 1 });

    // layout_examples
    await this.layoutExamples.createIndex({ industry: 1, pageType: 1, compositeScore: -1, qualityScore: -1 });

    // section_templates
    await this.sectionTemplates.createIndex({ type: 1, industry: 1, compositeScore: -1, qualityScore: -1 });
    await this.sectionTemplates.createIndex({ timesReused: -1 });

    // user_feedback
    await this.userFeedback.createIndex({ generationId: 1 });
    await this.userFeedback.createIndex({ action: 1, createdAt: -1 });

    // elo_matches (audit trail)
    await this.eloMatches.createIndex({ sectionType: 1, createdAt: -1 });
    await this.eloMatches.createIndex({ winnerId: 1 });

    // section_templates ELO
    await this.sectionTemplates.createIndex({ type: 1, "elo.rating": -1 });
    await this.sectionTemplates.createIndex({ type: 1, "elo.matches": 1 });

    // crawl_targets
    await this.crawlTargets.createIndex({ domain: 1 }, { unique: true });
    await this.crawlTargets.createIndex({ status: 1, tier: 1 });
    await this.crawlTargets.createIndex({ industry: 1 });

    // raw_sections
    await this.rawSections.createIndex({ sourceDomain: 1, "classification.category": 1 });
    await this.rawSections.createIndex({ "classification.tier": 1, status: 1 });
    await this.rawSections.createIndex({ structuralHash: 1 });
    await this.rawSections.createIndex({ extractedAt: -1 });

    // animation_patterns
    await this.animationPatterns.createIndex({ domain: 1, "pattern.type": 1, "pattern.trigger": 1 });
    await this.animationPatterns.createIndex({ frequency: -1 });

    console.log("[mongo] indexes ensured");
  }
}
