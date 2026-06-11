/**
 * BusinessInfo — structured "what does this company do" artifact.
 *
 * Extracted once per fetchPage from meta/OG/JSON-LD/hero paragraphs, then
 * classified by a fast JSON-mode LLM call into a fixed Sector/Tone taxonomy.
 *
 * Consumed by:
 *   1. persona scorer (personas.ts) — sector feeds the Aaker industry signal
 *      with confidence-scaled weight; tone feeds a new businessTone signal.
 *   2. section-generator prompt — injected as a <company> block so copy
 *      grounds to sector terminology/voice.
 *
 * Cached in-memory by root domain with a 30-day TTL (override via
 * CANVAS_BUSINESS_INFO_TTL_DAYS). Kill switch: CANVAS_BUSINESS_INFO_DISABLE=1.
 */

import { z } from "zod";
import { ModelRouter } from "./router.js";
import { NOOP_RUN, type PipelineRun } from "./logger.js";

export type Sector =
  | "finance" | "healthcare" | "ecommerce" | "saas" | "enterprise-tech"
  | "creative-agency" | "editorial-media" | "education" | "food-beverage"
  | "real-estate" | "travel-hospitality" | "professional-services"
  | "entertainment" | "nonprofit" | "luxury-retail" | "consumer-goods"
  | "industrial" | "automotive" | "fitness-wellness"
  | "sportswear" | "beauty-cosmetics" | "fashion-apparel"
  | "gaming" | "hardware-consumer" | "dev-tools"
  | "legal" | "government-public" | "crypto-web3"
  | "logistics-shipping" | "music-audio"
  | "general";

export type Tone =
  | "formal-corporate" | "technical-precise" | "warm-approachable"
  | "bold-confident" | "playful-energetic" | "aspirational-luxury"
  | "editorial-thoughtful" | "neutral";

const SECTOR_VALUES: Sector[] = [
  "finance", "healthcare", "ecommerce", "saas", "enterprise-tech",
  "creative-agency", "editorial-media", "education", "food-beverage",
  "real-estate", "travel-hospitality", "professional-services",
  "entertainment", "nonprofit", "luxury-retail", "consumer-goods",
  "industrial", "automotive", "fitness-wellness",
  "sportswear", "beauty-cosmetics", "fashion-apparel",
  "gaming", "hardware-consumer", "dev-tools",
  "legal", "government-public", "crypto-web3",
  "logistics-shipping", "music-audio",
  "general",
];
const TONE_VALUES: Tone[] = [
  "formal-corporate", "technical-precise", "warm-approachable",
  "bold-confident", "playful-energetic", "aspirational-luxury",
  "editorial-thoughtful", "neutral",
];

export interface BusinessInfo {
  whatTheyDo: string;       // <=140 chars, one sentence
  sector: Sector;
  audience: string;         // <=80 chars
  tone: Tone;
  confidence: number;       // 0..1
  sourceSignals: string[];  // which raw inputs we had (debugging)
  rawSummary: string;       // raw text we fed to the classifier
}

export interface BusinessSignals {
  metaDescription?: string;
  ogDescription?: string;
  twitterDescription?: string;
  jsonLdDescription?: string;
  heroParagraph?: string;
  navLabels?: string[];
}

// ─── 1. Signal extraction (no LLM) ──────────────────────────────────────

const META_DESC_RE = /<meta[^>]*\bname\s*=\s*["']description["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/i;
const OG_DESC_RE = /<meta[^>]*\bproperty\s*=\s*["']og:description["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/i;
const TW_DESC_RE = /<meta[^>]*\bname\s*=\s*["']twitter:description["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/i;
const JSONLD_RE = /<script[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const MAIN_RE = /<main\b[^>]*>([\s\S]*?)<\/main>/i;
const ARTICLE_RE = /<article\b[^>]*>([\s\S]*?)<\/article>/i;
const FIRST_P_RE = /<p\b[^>]*>([\s\S]*?)<\/p>/i;
const NAV_RE = /<nav\b[^>]*>([\s\S]*?)<\/nav>/i;
const ANCHOR_TEXT_RE = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

/** Walk all JSON-LD blocks, return the first description-like field found. */
function extractJsonLdDescription(html: string): string | undefined {
  let match: RegExpExecArray | null;
  const re = new RegExp(JSONLD_RE);
  while ((match = re.exec(html)) !== null) {
    try {
      const raw = match[1].trim();
      const data = JSON.parse(raw);
      const nodes = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        if (typeof node.description === "string" && node.description.trim().length >= 20) {
          return node.description.trim().slice(0, 500);
        }
      }
    } catch {
      // malformed JSON-LD — skip
    }
  }
  return undefined;
}

export function extractBusinessSignals(html: string): BusinessSignals {
  if (!html) return {};
  const out: BusinessSignals = {};

  const md = html.match(META_DESC_RE);
  if (md) out.metaDescription = decodeEntities(md[1]).trim().slice(0, 500);

  const og = html.match(OG_DESC_RE);
  if (og) out.ogDescription = decodeEntities(og[1]).trim().slice(0, 500);

  const tw = html.match(TW_DESC_RE);
  if (tw) out.twitterDescription = decodeEntities(tw[1]).trim().slice(0, 500);

  const jld = extractJsonLdDescription(html);
  if (jld) out.jsonLdDescription = decodeEntities(jld);

  // First <p> inside <main> or <article> — usually the hero subtitle or lede
  const mainBlock = html.match(MAIN_RE)?.[1] || html.match(ARTICLE_RE)?.[1];
  if (mainBlock) {
    const p = mainBlock.match(FIRST_P_RE);
    if (p) {
      const text = stripTags(decodeEntities(p[1]));
      if (text.length >= 20 && text.length <= 600) out.heroParagraph = text;
    }
  }

  // Nav labels: pull <a> text from the first <nav> block
  const navBlock = html.match(NAV_RE)?.[1];
  if (navBlock) {
    const labels: string[] = [];
    let am: RegExpExecArray | null;
    const re = new RegExp(ANCHOR_TEXT_RE);
    while ((am = re.exec(navBlock)) !== null) {
      const t = stripTags(decodeEntities(am[1]));
      if (t.length > 0 && t.length <= 40) labels.push(t);
      if (labels.length >= 10) break;
    }
    if (labels.length > 0) out.navLabels = labels;
  }

  return out;
}

/** Build the short seed text we send to the classifier. */
function buildSeedText(signals: BusinessSignals, brandName: string): { seed: string; sources: string[] } {
  const sources: string[] = [];
  const parts: string[] = [];
  if (signals.ogDescription)       { parts.push(`Description: ${signals.ogDescription}`); sources.push("og:description"); }
  else if (signals.metaDescription) { parts.push(`Description: ${signals.metaDescription}`); sources.push("meta:description"); }
  else if (signals.twitterDescription) { parts.push(`Description: ${signals.twitterDescription}`); sources.push("twitter:description"); }
  if (signals.jsonLdDescription && !parts.some(p => p.includes(signals.jsonLdDescription!))) {
    parts.push(`About: ${signals.jsonLdDescription}`);
    sources.push("json-ld");
  }
  if (signals.heroParagraph)       { parts.push(`Hero text: ${signals.heroParagraph}`); sources.push("hero-p"); }
  if (signals.navLabels && signals.navLabels.length > 0) {
    parts.push(`Navigation: ${signals.navLabels.join(" | ")}`);
    sources.push("nav-labels");
  }
  const seed = `Brand: ${brandName}\n${parts.join("\n")}`.slice(0, 2000);
  return { seed, sources };
}

// ─── 2. LLM classification ──────────────────────────────────────────────

const ClassifySchema = z.object({
  whatTheyDo: z.string().min(1).max(200),
  sector: z.enum([
    "finance", "healthcare", "ecommerce", "saas", "enterprise-tech",
    "creative-agency", "editorial-media", "education", "food-beverage",
    "real-estate", "travel-hospitality", "professional-services",
    "entertainment", "nonprofit", "luxury-retail", "consumer-goods",
    "industrial", "automotive", "fitness-wellness",
    "sportswear", "beauty-cosmetics", "fashion-apparel",
    "gaming", "hardware-consumer", "dev-tools",
    "legal", "government-public", "crypto-web3",
    "logistics-shipping", "music-audio",
    "general",
  ]),
  audience: z.string().min(1).max(120),
  tone: z.enum([
    "formal-corporate", "technical-precise", "warm-approachable",
    "bold-confident", "playful-energetic", "aspirational-luxury",
    "editorial-thoughtful", "neutral",
  ]),
  confidence: z.number().min(0).max(1),
});

const CLASSIFIER_SYSTEM = `You classify companies from short excerpts of their website. You output strict JSON only — no prose, no markdown fences.

Return this exact shape:
{
  "whatTheyDo": "one sentence, <=140 chars, active voice, describe what the company does for whom",
  "sector": "<one of: finance, healthcare, ecommerce, saas, enterprise-tech, creative-agency, editorial-media, education, food-beverage, real-estate, travel-hospitality, professional-services, entertainment, nonprofit, luxury-retail, consumer-goods, industrial, automotive, fitness-wellness, sportswear, beauty-cosmetics, fashion-apparel, gaming, hardware-consumer, dev-tools, legal, government-public, crypto-web3, logistics-shipping, music-audio, general>",
  "audience": "<=80 chars, describe the primary audience (e.g. 'institutional investors', 'parents of young children', 'enterprise IT teams')",
  "tone": "<one of: formal-corporate, technical-precise, warm-approachable, bold-confident, playful-energetic, aspirational-luxury, editorial-thoughtful, neutral>",
  "confidence": <number 0..1 — how confident you are in sector+tone given the evidence>
}

Sector disambiguation (IMPORTANT — pick the most specific match, never fall back to a broader bucket when a precise one exists):
- 'sportswear' = athletic apparel, footwear, performance gear (Nike, adidas, Under Armour, Puma, Asics, Lululemon). NOT 'fashion-apparel' or 'consumer-goods'.
- 'fashion-apparel' = mid-market clothing brands, streetwear, non-premium fashion (Zara, H&M, Uniqlo, Gap, Supreme). If the site is clearly luxury/couture use 'luxury-retail' instead.
- 'luxury-retail' = high-end fashion houses, watches, jewelry, couture (Rolex, LVMH, Hermès, Cartier).
- 'beauty-cosmetics' = makeup, skincare, haircare, fragrance (Sephora, Glossier, Estée Lauder, L'Oréal, Fenty). NOT 'fitness-wellness' (which is gyms/supplements/wellness apps).
- 'gaming' = video games, game studios, esports, gaming platforms (Riot, Epic, Steam, PlayStation). NOT 'entertainment' (which is film/TV/theater).
- 'hardware-consumer' = branded physical tech products for end users (Apple, Dyson, Sonos, Peloton hardware, Bose). NOT 'consumer-goods' (which is CPG, household, food-adjacent) and NOT 'enterprise-tech'.
- 'dev-tools' = developer-facing software, APIs, infra platforms (GitHub, Stripe, Vercel, Linear, Supabase, Postman). This is a precise subset of saas — use it whenever the primary audience is developers.
- 'saas' = business software not in dev-tools, usually subscription (Salesforce, HubSpot, Notion for general use, Zoom).
- 'enterprise-tech' = large-scale infra, IT services, consulting (IBM, Accenture, Oracle, Cisco).
- 'legal' = law firms, legal-tech, compliance software (Clifford Chance, Clio, LegalZoom).
- 'government-public' = cities, agencies, public services, .gov (USA.gov, NHS, transit authorities, municipal sites).
- 'crypto-web3' = crypto exchanges, wallets, L1/L2 chains, DeFi, NFT platforms (Coinbase, Uniswap, OpenSea, Ethereum Foundation).
- 'logistics-shipping' = freight, parcel, supply chain (FedEx, DHL, Maersk, UPS, Flexport).
- 'music-audio' = music streaming, record labels, music hardware, audio software (Spotify, Apple Music, Fender, Ableton).
- 'automotive' = car manufacturers and dealerships (Tesla, BMW, Toyota).
- 'editorial-media' = news, magazines, long-form publications (The Verge, NYT, The Atlantic).
- 'entertainment' = film, TV, streaming video, theaters, live events (Netflix, Disney, A24, Ticketmaster).
- 'consumer-goods' = physical products for end consumers NOT covered by the more specific sectors above (Procter & Gamble, Unilever, household brands).
- 'general' = use ONLY when evidence is thin or contradictory.

Tone is the VOICE OF THE SITE, not the visitor. An asset manager is usually 'formal-corporate'; a dev tools startup is usually 'technical-precise' or 'bold-confident'; a children's brand is usually 'warm-approachable' or 'playful-energetic'; a sportswear brand is usually 'bold-confident'.

If the evidence is very thin (only a brand name, no description), set confidence <= 0.4. Never invent facts — only classify from what the excerpt actually says.`;

/**
 * Classify a seed string into BusinessInfo via one JSON-mode LLM call.
 * Uses the intent_parse pipeline stage (deepseek chat v3, json_object format, ~1s).
 * Returns null on failure so callers fall back gracefully.
 */
export async function classifyBusinessInfo(
  signals: BusinessSignals,
  brandName: string,
  router: ModelRouter,
  logger?: PipelineRun,
): Promise<BusinessInfo | null> {
  const log = logger || NOOP_RUN;
  const { seed, sources } = buildSeedText(signals, brandName);
  if (sources.length === 0) {
    log.debug(`business-info: no signals to classify for "${brandName}"`);
    return null;
  }

  try {
    const result = await router.routeJSON(
      "intent_parse",
      [
        { role: "system", content: CLASSIFIER_SYSTEM },
        { role: "user", content: seed },
      ],
      ClassifySchema,
      { logger },
    );

    const info: BusinessInfo = {
      whatTheyDo: result.whatTheyDo.trim().slice(0, 140),
      sector: result.sector,
      audience: result.audience.trim().slice(0, 80),
      tone: result.tone,
      confidence: Math.max(0, Math.min(1, result.confidence)),
      sourceSignals: sources,
      rawSummary: seed,
    };
    log.info(`business-info: sector=${info.sector} tone=${info.tone} conf=${info.confidence.toFixed(2)} (${sources.length} signals)`);
    return info;
  } catch (err) {
    log.warn(`business-info classify failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

// ─── 3. In-memory cache keyed by root domain ────────────────────────────

interface CacheEntry {
  info: BusinessInfo;
  storedAt: number;
}

const CACHE = new Map<string, CacheEntry>();

function rootDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function ttlMs(): number {
  const envDays = Number(process.env.CANVAS_BUSINESS_INFO_TTL_DAYS);
  const days = Number.isFinite(envDays) && envDays > 0 ? envDays : 30;
  return days * 24 * 60 * 60 * 1000;
}

/**
 * Look up BusinessInfo from cache, or extract + classify + cache.
 * Returns null if the kill switch is set, if no signals can be extracted, or
 * if the LLM call fails.
 */
export async function getOrCreateBusinessInfo(
  url: string,
  html: string,
  brandName: string,
  router: ModelRouter,
  logger?: PipelineRun,
): Promise<BusinessInfo | null> {
  if (process.env.CANVAS_BUSINESS_INFO_DISABLE === "1") return null;

  const log = logger || NOOP_RUN;
  const domain = rootDomain(url);
  const now = Date.now();

  const cached = CACHE.get(domain);
  if (cached && now - cached.storedAt < ttlMs()) {
    log.info(`business-info: cache hit for ${domain} (sector=${cached.info.sector})`);
    return cached.info;
  }

  const signals = extractBusinessSignals(html);
  const sigCount = Object.values(signals).filter(v => v && (Array.isArray(v) ? v.length > 0 : true)).length;
  if (sigCount === 0) {
    log.debug(`business-info: no signals extracted for ${domain}`);
    return null;
  }
  log.debug(`business-info: ${sigCount} signals extracted for ${domain}`);

  const info = await classifyBusinessInfo(signals, brandName, router, logger);
  if (!info) return null;

  CACHE.set(domain, { info, storedAt: now });
  return info;
}

/** Format BusinessInfo as a compact <company> block for section prompts. */
export function formatCompanyBlock(info: BusinessInfo): string {
  return `<company>
What they do: ${info.whatTheyDo}
Sector: ${info.sector}
Audience: ${info.audience}
Tone: ${info.tone}
</company>`;
}

/** Testing hook — clear the cache between runs. */
export function _clearBusinessInfoCache(): void {
  CACHE.clear();
}

/** Testing hook — read the taxonomy enum values (useful for fixtures). */
export const BUSINESS_INFO_SECTORS = SECTOR_VALUES;
export const BUSINESS_INFO_TONES = TONE_VALUES;
