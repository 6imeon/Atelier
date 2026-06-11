// Mine the top N content-bearing image and video URLs from a crawled HTML
// document. Used to feed real source assets back into section-generation
// prompts so generated pages reuse the brand's actual photography instead
// of random Picsum placeholders.
//
// Filters out icons, tracking pixels, sprites, and tiny decorative images.
// Ranks remaining candidates by signals that correlate with content imagery
// (large declared dimensions, alt text presence, asset-path keywords).

const SKIP_URL_FRAGMENTS = [
  "favicon",
  "sprite",
  "icon-",
  "/icons/",
  "tracking",
  "pixel",
  "beacon",
  "1x1",
  "spacer",
  "blank.gif",
  "data:image",
  // NOTE: "logo" was removed from this list — it over-blocks meaningful
  // content logos (client/partner/portfolio/group-company logos like
  // /images/logos/blacksun.svg) that belong in a "Our companies" or
  // "Our clients" section. Tiny chrome logos without explicit dimensions
  // still score negatively via scoreCandidate() and drop off anyway.
];

const CONTENT_PATH_HINTS = [
  "/hero",
  "/banner",
  "/gallery",
  "/story",
  "/photo",
  "/image",
  "/asset",
  "/upload",
  "/media",
  "/cms",
  "/content",
  "/logos/",   // agency/portfolio/group-company logo folders
  "/clients/", // client-logo galleries
  "/partners/",
];

interface ImgCandidate {
  url: string;
  alt: string;
  width: number;
  height: number;
  score: number;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, "")
    .replace(/&#34;/g, "")
    .replace(/&apos;/g, "")
    .replace(/&#39;/g, "")
    .replace(/&amp;/g, "&");
}

function resolveUrl(src: string, baseUrl?: string): string | null {
  if (!src) return null;
  src = decodeEntities(src.trim());
  if (!src || src.startsWith("data:")) return null;
  // Reject anything that still contains stray quote chars after decoding
  if (/["']/.test(src)) return null;
  if (src.startsWith("//")) return `https:${src}`;
  if (/^https?:\/\//i.test(src)) return src;
  if (!baseUrl) return null;
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
}

function shouldSkip(url: string): boolean {
  const lower = url.toLowerCase();
  return SKIP_URL_FRAGMENTS.some(frag => lower.includes(frag));
}

function scoreCandidate(c: ImgCandidate): number {
  let score = 0;
  if (c.width >= 800) score += 4;
  else if (c.width >= 400) score += 2;
  else if (c.width > 0 && c.width < 100) score -= 5;
  if (c.height >= 600) score += 3;
  else if (c.height >= 300) score += 1;
  else if (c.height > 0 && c.height < 100) score -= 3;
  if (c.alt && c.alt.length >= 8) score += 2;
  const lower = c.url.toLowerCase();
  if (CONTENT_PATH_HINTS.some(h => lower.includes(h))) score += 3;
  if (/\.(webp|jpg|jpeg|png)(\?|$)/i.test(lower)) score += 1;
  return score;
}

export interface ExtractedSourceAssets {
  images: string[];
  videos: string[];
}

export function extractSourceAssets(html: string, baseUrl?: string, opts?: { maxImages?: number; maxVideos?: number }): ExtractedSourceAssets {
  const maxImages = opts?.maxImages ?? 20;
  const maxVideos = opts?.maxVideos ?? 6;

  const candidates = new Map<string, ImgCandidate>();

  // <img src="..." alt="..." width="..." height="...">
  // Also handles srcset by taking the first declared candidate.
  const imgRe = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    const tag = m[0];
    const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    const srcsetMatch = !srcMatch ? tag.match(/\bsrcset\s*=\s*["']([^"']+)["']/i) : null;
    const src = srcMatch?.[1] || srcsetMatch?.[1]?.split(",")[0]?.trim().split(/\s+/)[0] || "";
    const resolved = resolveUrl(src, baseUrl);
    if (!resolved || shouldSkip(resolved)) continue;
    const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] || "";
    const width = parseInt(tag.match(/\bwidth\s*=\s*["']?(\d+)/i)?.[1] || "0", 10);
    const height = parseInt(tag.match(/\bheight\s*=\s*["']?(\d+)/i)?.[1] || "0", 10);
    const cand: ImgCandidate = { url: resolved, alt, width, height, score: 0 };
    cand.score = scoreCandidate(cand);
    const existing = candidates.get(resolved);
    if (!existing || cand.score > existing.score) candidates.set(resolved, cand);
  }

  // Inline-style background-image: url(...)
  const bgRe = /background-image\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((m = bgRe.exec(html)) !== null) {
    const resolved = resolveUrl(m[1], baseUrl);
    if (!resolved || shouldSkip(resolved)) continue;
    const cand: ImgCandidate = { url: resolved, alt: "", width: 1200, height: 800, score: 0 };
    cand.score = scoreCandidate(cand);
    if (!candidates.has(resolved)) candidates.set(resolved, cand);
  }

  const images = [...candidates.values()]
    .filter(c => c.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxImages)
    .map(c => c.url);

  // Videos: <video src="...">, <video><source src="...">, <video poster="...">
  const videoSet = new Set<string>();
  const videoTagRe = /<video\b[^>]*>([\s\S]*?)<\/video>/gi;
  while ((m = videoTagRe.exec(html)) !== null) {
    const tag = m[0];
    const inner = m[1];
    const direct = tag.match(/<video\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (direct) {
      const r = resolveUrl(direct, baseUrl);
      if (r && !shouldSkip(r)) videoSet.add(r);
    }
    const sourceRe = /<source\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
    let sm: RegExpExecArray | null;
    while ((sm = sourceRe.exec(inner)) !== null) {
      const r = resolveUrl(sm[1], baseUrl);
      if (r && !shouldSkip(r)) videoSet.add(r);
    }
  }

  return { images, videos: [...videoSet].slice(0, maxVideos) };
}
