import { ProjectData, UserData, ListProjectsOptions } from "../models/project.js";
import { ScreenData } from "../models/screen.js";
import { DesignSystem } from "../models/design-system.js";
import type { UIComponentData, ComponentCategory } from "../models/component.js";

export interface StorageAdapter {
  // Users
  upsertUser(data: UserData): Promise<void>;
  getUser(id: string): Promise<UserData | null>;
  getUserByEntraOid(oid: string): Promise<UserData | null>;

  // Projects
  createProject(data: ProjectData): Promise<void>;
  getProject(id: string): Promise<ProjectData | null>;
  listProjects(opts?: ListProjectsOptions): Promise<{ projects: ProjectData[]; nextCursor?: string }>;
  updateProject(id: string, data: Partial<ProjectData>): Promise<void>;
  deleteProject(id: string): Promise<void>;
  touchProject(id: string): Promise<void>;
  deleteStaleProjects(cutoffDays: number): Promise<number>;
  createScreen(projectId: string, data: ScreenData): Promise<void>;
  getScreen(projectId: string, screenId: string): Promise<ScreenData | null>;
  listScreens(projectId: string): Promise<ScreenData[]>;
  updateScreen(projectId: string, screenId: string, data: Partial<ScreenData>): Promise<void>;
  deleteScreen(projectId: string, screenId: string): Promise<void>;
  setDesignSystem(projectId: string, ds: DesignSystem): Promise<void>;
  getDesignSystem(projectId: string): Promise<DesignSystem | null>;
  // Canvas-side (web-ui) design system: user-facing palette/fonts/radius config.
  // Opaque to the SDK — shape is owned by the web-ui CanvasDesignSystem type.
  setCanvasDesignSystem(projectId: string, ds: unknown): Promise<void>;
  getCanvasDesignSystem(projectId: string): Promise<unknown | null>;
  saveAsset(key: string, data: Buffer | string): Promise<string>;
  getAsset(key: string): Promise<Buffer | string | null>;
  deleteAsset(key: string): Promise<void>;
  // Component library
  saveComponent(data: UIComponentData): Promise<void>;
  getComponent(id: string): Promise<UIComponentData | null>;
  listComponents(category?: ComponentCategory): Promise<UIComponentData[]>;
  searchComponents(query: string): Promise<UIComponentData[]>;
  deleteComponent(id: string): Promise<void>;
  incrementComponentUsage(id: string): Promise<void>;
  initialize(): Promise<void>;
  close(): Promise<void>;
}

// ─── Analytics / Learning Layer Types ───

export interface GenerationLog {
  projectId?: string;
  screenId?: string;
  pipeline: string;
  model: string;
  prompt: { systemLength: number; userLength: number; sectionType?: string };
  response: { htmlLength: number; sectionsCount?: number; hasAnimations?: boolean; truncated: boolean };
  performance: { durationMs: number; tokensIn?: number; tokensOut?: number; retries: number; fallbackUsed: boolean };
  quality: { contrastPass?: boolean; validHtml?: boolean; userRating?: number | null; kept?: boolean };
}

export interface BrandCache {
  domain: string;
  url: string;
  colors: { primary: string; secondary?: string; accent?: string; all: Array<{ hex: string; frequency: number; logoBonus: number; label?: string }> };
  fonts: { heading?: { family: string; weight?: string; source?: string }; body?: { family: string; weight?: string; source?: string } };
  logoUrl?: string;
  aakerVector?: number[];
  personaId?: string;
  sectionTypes?: string[];
  extractedAt: string;
  lastUsed: string;
  useCount: number;
}

export interface LayoutExample {
  industry: string;
  pageType: string;
  sectionSequence: string[];
  sectionCount: number;
  metadata: { sourceUrl?: string; personaId?: string; aakerVector?: number[]; deviceType?: string; colorScheme?: string };
  sections: Array<{ type: string; htmlSnippet: string; tailwindClasses?: string[]; hasAnimation?: boolean }>;
  qualityScore: number;
  positiveRatings: number;
  negativeRatings: number;
  compositeScore: number;
  embedding?: number[];
}

export interface EloRating {
  rating: number;      // Starts at 1500
  matches: number;     // Total pairwise comparisons
  wins: number;        // Times picked as winner
  sigma: number;       // Uncertainty (starts at 350, decreases with matches)
}

export interface SectionTemplate {
  type: string;
  industry?: string;
  style?: string;
  html: string;
  htmlLength: number;
  features: { hasAnimation?: boolean; hasCta?: boolean; hasImage?: boolean; columnCount?: number; tailwindClasses?: string[] };
  qualityScore: number;
  positiveRatings: number;
  negativeRatings: number;
  compositeScore: number;
  elo: EloRating;
  timesReused: number;
  sourceGenerationId?: string;
}

export interface UserFeedback {
  generationId?: string;
  projectId: string;
  screenId: string;
  action: "kept" | "deleted" | "edited" | "exported" | "variant_created";
  editDelta?: { sectionsModified?: number; htmlDiffSize?: number };
  explicitRating?: number | null;
  sectionRatings?: Array<{ sectionType: string; vote: "up" | "down" }>;
  timeToAction?: number;
}

export interface QualitySummary {
  avgCompositeScore: number;
  avgPageRating: number | null;
  bestSectionType: { type: string; score: number } | null;
  worstSectionType: { type: string; score: number } | null;
  totalTemplates: number;
  totalEloMatches: number;
  totalFeedback: number;
  ratingTrend7d: number | null;   // delta vs 7 days ago
}

export interface RatingTrend {
  date: string;         // YYYY-MM-DD
  avgCompositeScore: number;
  avgEloRating: number;
  feedbackCount: number;
  eloMatchCount: number;
}

export interface AnalyticsAdapter {
  logGeneration(data: GenerationLog): Promise<void>;
  getBrandCache(domain: string): Promise<BrandCache | null>;
  setBrandCache(domain: string, data: BrandCache): Promise<void>;
  getLayoutExamples(industry: string, pageType: string, limit?: number): Promise<LayoutExample[]>;
  saveLayoutExample(data: LayoutExample): Promise<void>;
  saveSectionTemplate(data: SectionTemplate): Promise<void>;
  getSectionTemplates(type: string, industry?: string, limit?: number): Promise<SectionTemplate[]>;
  logFeedback(data: UserFeedback): Promise<void>;
  adjustTemplateScores(action: "exported" | "kept" | "deleted" | "edited" | "variant_created", recentMinutes?: number): Promise<number>;
  rateSectionTemplate(sectionType: string, vote: "up" | "down", recentMinutes?: number): Promise<number>;
  submitEloComparison(winnerId: string, loserId: string, outcome: "win" | "draw", sectionType: string): Promise<void>;
  getEloPair(sectionType: string): Promise<{ a: SectionTemplate & { _id: string }; b: SectionTemplate & { _id: string } } | null>;
  getEloLeaderboard(sectionType: string, limit?: number): Promise<Array<{ _id: string; type: string; style?: string; rating: number; matches: number; wins: number; htmlSnippet: string }>>;
  getSectionTypes(): Promise<Array<{ type: string; count: number }>>;
  getQualitySummary(): Promise<QualitySummary>;
  getRatingTrends(days?: number): Promise<RatingTrend[]>;
  applyEloDecay(staleDays?: number): Promise<number>;
  getStats(): Promise<{ collections: Record<string, number>; totalDocs: number; estimatedSizeMB: number }>;
  initialize(): Promise<void>;
  close(): Promise<void>;
}

// ─── Component Engine Types ───

export interface CrawlTarget {
  url: string;
  domain: string;
  industry: string;
  tier: "ftse100" | "sp500" | "awwwards" | "saas" | "custom";
  lastCrawled?: string;
  crawlCount: number;
  pagesCrawled: string[];
  sectionsExtracted: number;
  status: "pending" | "crawled" | "failed";
  createdAt: string;
}

export interface RawSectionDoc {
  sourceUrl: string;
  sourceDomain: string;
  industry: string;
  html: string;
  htmlLength: number;
  textContent: string;
  visualHash?: string;
  classification: {
    category: string;
    confidence: number;
    subType?: string;
    method: "semantic" | "heuristic" | "llm";
    tier: "basic" | "interactive" | "animated" | "cinematic";
    features: {
      hasAnimation: boolean;
      hasCta: boolean;
      hasImage: boolean;
      hasVideo: boolean;
      hasForm: boolean;
      hasCarousel: boolean;
      columnCount: number;
      isInteractive: boolean;
    };
  };
  animations: Array<{
    type: string;
    trigger: string;
    properties: string[];
    duration?: number;
    easing?: string;
    description: string;
  }>;
  animationBrief?: {
    sectionType: string;
    animationStyle: string;
    effects: Array<{
      element: string;
      animation: string;
      trigger: string;
      timing: string;
      detail: string;
    }>;
    libraries: string[];
    complexity: "basic" | "intermediate" | "advanced" | "cinematic";
  };
  structuralHash: string;
  status: "raw" | "classified" | "briefed" | "accepted" | "rejected";
  extractedAt: string;
}

export interface AnimationPatternRecord {
  domain: string;
  url: string;
  industry: string;
  pattern: {
    type: string;
    trigger: string;
    properties: string[];
    description: string;
  };
  frequency: number;
  firstSeen: string;
  lastSeen: string;
  exampleSectionIds: string[];
}

export interface ComponentEngineAdapter {
  // Crawl targets
  saveCrawlTarget(target: CrawlTarget): Promise<void>;
  getCrawlTarget(domain: string): Promise<CrawlTarget | null>;
  listCrawlTargets(filter?: { status?: string; tier?: string; industry?: string }): Promise<CrawlTarget[]>;
  updateCrawlTarget(domain: string, update: Partial<CrawlTarget>): Promise<void>;
  // Raw sections
  saveRawSection(section: RawSectionDoc): Promise<string>;
  getRawSections(filter?: { domain?: string; category?: string; tier?: string; status?: string }, limit?: number): Promise<Array<RawSectionDoc & { _id: string }>>;
  updateRawSectionStatus(id: string, status: RawSectionDoc["status"]): Promise<void>;
  updateRawSectionBrief(id: string, brief: RawSectionDoc["animationBrief"]): Promise<void>;
  // Animation patterns
  upsertAnimationPattern(record: AnimationPatternRecord): Promise<void>;
  getAnimationPatterns(filter?: { domain?: string; type?: string }, limit?: number): Promise<AnimationPatternRecord[]>;
  getPatternCatalogue(): Promise<Array<{ type: string; trigger: string; frequency: number; domains: number }>>;
  // Stats
  getEngineStats(): Promise<{ crawlTargets: number; rawSections: number; animationPatterns: number; byTier: Record<string, number>; byCategory: Record<string, number> }>;
}

// ─── Runtime Storage ───

export type StorageBackend = "memory" | "sqlite";

export async function createStorage(backend: StorageBackend = "memory", opts: Record<string, unknown> = {}): Promise<StorageAdapter> {
  if (backend === "sqlite") {
    const { SQLiteStorage } = await import("./sqlite.js");
    const s = new SQLiteStorage(opts.path as string);
    await s.initialize();
    return s;
  }
  const { MemoryStorage } = await import("./memory.js");
  const s = new MemoryStorage();
  await s.initialize();
  return s;
}

export async function createAnalytics(mongoUri?: string): Promise<AnalyticsAdapter | null> {
  if (!mongoUri) return null;
  const { MongoAnalytics } = await import("./mongodb.js");
  const a = new MongoAnalytics(mongoUri);
  await a.initialize();
  return a;
}
