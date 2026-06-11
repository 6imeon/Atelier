"use strict";
/**
 * Brand Extractor — TypeScript port of BrandExtractor/Marque
 * Extracts colors, fonts, and logos from HTML + CSS without AI.
 * Uses regex-based CSS parsing (no browser DOM needed).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rgbToHex = rgbToHex;
exports.hexToRgb = hexToRgb;
exports.rgbToHsl = rgbToHsl;
exports.extractColors = extractColors;
exports.extractFonts = extractFonts;
exports.extractLogos = extractLogos;
exports.fetchLogoData = fetchLogoData;
exports.extractBrandData = extractBrandData;
exports.extractBrandDataFull = extractBrandDataFull;
// ─── Color Utilities ────────────────────────────────────────────────
function rgbToHex(r, g, b) {
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
function hexToRgb(hex) {
    let h = hex.replace(/^#/, "");
    if (h.length === 3)
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length < 6)
        return null;
    h = h.slice(0, 6);
    const n = parseInt(h, 16);
    if (isNaN(n))
        return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHsl(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rn)
            h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        else if (max === gn)
            h = ((bn - rn) / d + 2) / 6;
        else
            h = ((rn - gn) / d + 4) / 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function toColorInfo(hex, source) {
    const rgb = hexToRgb(hex);
    if (!rgb)
        return null;
    return { hex, rgb, hsl: rgbToHsl(rgb.r, rgb.g, rgb.b), source };
}
function parseColorToHex(color) {
    color = color.trim().toLowerCase();
    // Hex
    const hexMatch = color.match(/^#([a-f0-9]{3,8})$/);
    if (hexMatch) {
        let h = hexMatch[1];
        if (h.length === 3)
            h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return `#${h.slice(0, 6)}`;
    }
    // rgb/rgba
    const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)/);
    if (rgbMatch)
        return rgbToHex(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
    return null;
}
function isNearWhite(hex) {
    const rgb = hexToRgb(hex);
    return !!rgb && rgb.r > 230 && rgb.g > 230 && rgb.b > 230;
}
function isNearBlack(hex) {
    const rgb = hexToRgb(hex);
    return !!rgb && rgb.r < 40 && rgb.g < 40 && rgb.b < 40;
}
function isGray(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb)
        return false;
    return rgbToHsl(rgb.r, rgb.g, rgb.b).s < 10;
}
function getSaturation(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb)
        return 0;
    return rgbToHsl(rgb.r, rgb.g, rgb.b).s;
}
function deduplicateColors(colors, threshold = 30) {
    const unique = [];
    for (const color of colors) {
        const rgb = hexToRgb(color);
        if (!rgb)
            continue;
        const isDupe = unique.some(u => {
            const urgb = hexToRgb(u);
            return !!urgb && Math.abs(rgb.r - urgb.r) + Math.abs(rgb.g - urgb.g) + Math.abs(rgb.b - urgb.b) < threshold;
        });
        if (!isDupe)
            unique.push(color);
    }
    return unique;
}
const CSS_COLOR_RE = /#[a-f0-9]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/gi;
function extractColors(html, stylesheets = []) {
    const allHexColors = [];
    // Phase 1: Extract from inline style attributes
    const styleAttrRe = /style="([^"]+)"/gi;
    let m;
    while ((m = styleAttrRe.exec(html)) !== null) {
        const style = m[1];
        const colorMatches = style.match(CSS_COLOR_RE) || [];
        for (const c of colorMatches) {
            const hex = parseColorToHex(c);
            if (hex)
                allHexColors.push(hex);
        }
    }
    // Phase 2: Extract from <style> tags
    const styleTagRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    while ((m = styleTagRe.exec(html)) !== null) {
        const css = m[1];
        const colorMatches = css.match(CSS_COLOR_RE) || [];
        for (const c of colorMatches) {
            const hex = parseColorToHex(c);
            if (hex)
                allHexColors.push(hex);
        }
    }
    // Phase 3: Extract from external stylesheets
    for (const sheet of stylesheets) {
        const colorMatches = sheet.match(CSS_COLOR_RE) || [];
        for (const c of colorMatches) {
            const hex = parseColorToHex(c);
            if (hex)
                allHexColors.push(hex);
        }
    }
    // Phase 4: Extract hex colors from anywhere in HTML (Tailwind config, data attributes, etc.)
    const globalHexRe = /#[a-f0-9]{6}\b/gi;
    const globalMatches = html.match(globalHexRe) || [];
    for (const c of globalMatches) {
        const hex = parseColorToHex(c);
        if (hex)
            allHexColors.push(hex);
    }
    // Frequency tracking
    const frequency = {};
    for (const hex of allHexColors)
        frequency[hex] = (frequency[hex] || 0) + 1;
    // Deduplicate and categorize
    const allUnique = deduplicateColors(Object.keys(frequency), 25);
    const colorful = [];
    const grays = [];
    const backgrounds = [];
    const texts = [];
    for (const hex of allUnique) {
        if (isNearWhite(hex))
            backgrounds.push(hex);
        else if (isNearBlack(hex))
            texts.push(hex);
        else if (isGray(hex))
            grays.push(hex);
        else
            colorful.push(hex);
    }
    // Sort by saturation then frequency
    colorful.sort((a, b) => getSaturation(b) - getSaturation(a) || (frequency[b] || 0) - (frequency[a] || 0));
    const primary = colorful[0] || grays[0] || null;
    const secondary = colorful[1] || grays[0] || null;
    const accent = colorful[2] || grays[0] || null;
    // Build all-colors list
    const allOrdered = [...colorful, ...grays, ...backgrounds, ...texts];
    const allColors = [];
    for (const hex of allOrdered.slice(0, 20)) {
        const info = toColorInfo(hex, "css");
        if (info)
            allColors.push(info);
    }
    return {
        primary: primary ? toColorInfo(primary, "css") : null,
        secondary: secondary ? toColorInfo(secondary, "css") : null,
        accent: accent ? toColorInfo(accent, "css") : null,
        background: backgrounds.length ? toColorInfo(backgrounds[0], "css") : toColorInfo("#ffffff", "css"),
        text: texts.length ? toColorInfo(texts[0], "css") : toColorInfo("#000000", "css"),
        all: allColors,
    };
}
// ─── Font Extraction ────────────────────────────────────────────────
const SYSTEM_FONTS = new Set([
    "arial", "helvetica", "times new roman", "times", "courier new", "courier",
    "verdana", "georgia", "palatino", "garamond", "comic sans ms", "impact",
    "trebuchet ms", "arial black", "system-ui", "-apple-system", "segoe ui",
    "roboto", "sans-serif", "serif", "monospace", "cursive", "fantasy",
    "ui-sans-serif", "ui-serif", "ui-monospace", "inter",
]);
function cleanFontFamily(family) {
    return family.split(",")[0].trim().replace(/['"]/g, "");
}
function buildCssVarMap(cssSources) {
    const vars = {};
    for (const css of cssSources) {
        const re = /(--[\w-]+)\s*:\s*([^;}]+)/g;
        let m;
        while ((m = re.exec(css)) !== null) {
            vars[m[1].trim()] = m[2].trim();
        }
    }
    return vars;
}
function resolveCssVars(value, varMap, depth = 0) {
    if (depth > 3 || !value.includes("var("))
        return value;
    return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name, fallback) => {
        const resolved = varMap[name];
        if (resolved)
            return resolveCssVars(resolved, varMap, depth + 1);
        if (fallback)
            return resolveCssVars(fallback.trim(), varMap, depth + 1);
        return "";
    });
}
function parseGoogleFontsUrls(urls) {
    const results = [];
    for (const url of urls) {
        const familyRe = /family=([^&]+)/g;
        let m;
        while ((m = familyRe.exec(url)) !== null) {
            const raw = decodeURIComponent(m[1]);
            const parts = raw.split("@");
            const family = parts[0].split(":")[0].replace(/\+/g, " ").trim();
            if (!family)
                continue;
            const weights = [];
            if (parts[1]) {
                for (const part of parts[1].split(";")) {
                    const segments = part.split(",");
                    const w = segments[segments.length - 1];
                    if (w && /^\d+$/.test(w))
                        weights.push(w);
                }
            }
            if (!weights.length)
                weights.push("400");
            const existing = results.find(r => r.family.toLowerCase() === family.toLowerCase());
            if (existing) {
                for (const w of weights)
                    if (!existing.weights.includes(w))
                        existing.weights.push(w);
            }
            else {
                results.push({ family, weights });
            }
        }
    }
    return results;
}
function guessTagFromSelector(selector) {
    const lower = selector.toLowerCase();
    const hMatch = lower.match(/\b(h[1-6])\b/);
    if (hMatch)
        return hMatch[1];
    if (/\bbody\b|\bhtml\b|\*/.test(lower))
        return "div";
    if (/\bp\b/.test(lower))
        return "p";
    if (/\ba\b/.test(lower))
        return "a";
    if (/\bspan\b/.test(lower))
        return "span";
    return "div";
}
function extractFonts(html) {
    // Detect Google Fonts URLs
    const googleFontsUrls = [];
    const linkRe = /<link[^>]+href="([^"]*fonts\.googleapis\.com[^"]*)"[^>]*>/gi;
    let m;
    while ((m = linkRe.exec(html)) !== null)
        googleFontsUrls.push(m[1]);
    // Also from @import in style tags
    const importRe = /@import\s+url\(\s*['"]?(https?:\/\/fonts\.googleapis\.com[^'"\s)]+)['"]?\s*\)/gi;
    while ((m = importRe.exec(html)) !== null)
        googleFontsUrls.push(m[1]);
    // Detect Adobe Fonts
    const hasAdobe = /use\.typekit\.net|fonts\.adobe\.com/i.test(html);
    // Collect all CSS sources
    const cssSources = [];
    const styleTagRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    while ((m = styleTagRe.exec(html)) !== null)
        cssSources.push(m[1]);
    const cssVarMap = buildCssVarMap(cssSources);
    // Extract @font-face declarations
    const fontFaces = [];
    for (const css of cssSources) {
        const ffRe = /@font-face\s*\{([^}]+)\}/gi;
        let fm;
        while ((fm = ffRe.exec(css)) !== null) {
            const block = fm[1];
            const familyMatch = block.match(/font-family\s*:\s*['"]?([^;'"]+)['"]?\s*;/i);
            const weightMatch = block.match(/font-weight\s*:\s*([^;]+);/i);
            if (familyMatch) {
                fontFaces.push({
                    family: familyMatch[1].trim().replace(/['"]/g, ""),
                    weight: weightMatch ? weightMatch[1].trim() : "400",
                });
            }
        }
    }
    // Extract font-family from CSS rules
    const fontMap = {};
    for (const css of cssSources) {
        const ffRe = /font-family\s*:\s*([^;}"]+)/gi;
        let fm;
        while ((fm = ffRe.exec(css)) !== null) {
            const before = css.slice(0, fm.index);
            const lastBrace = before.lastIndexOf("{");
            let selector = "";
            if (lastBrace >= 0) {
                const lastClose = before.lastIndexOf("}", lastBrace);
                selector = before.slice(lastClose + 1, lastBrace).trim();
            }
            const tag = guessTagFromSelector(selector);
            let family = fm[1].trim();
            if (family.includes("var("))
                family = resolveCssVars(family, cssVarMap);
            const clean = cleanFontFamily(family);
            if (!clean || clean === "inherit" || clean === "initial" || clean.startsWith("var("))
                continue;
            if (!fontMap[clean])
                fontMap[clean] = { weights: new Set(), tags: new Set(), count: 0 };
            fontMap[clean].weights.add("400");
            fontMap[clean].tags.add(tag);
            fontMap[clean].count++;
        }
    }
    // Extract from inline styles
    const inlineRe = /style="[^"]*font-family\s*:\s*([^;"]+)/gi;
    while ((m = inlineRe.exec(html)) !== null) {
        let family = m[1].trim();
        if (family.includes("var("))
            family = resolveCssVars(family, cssVarMap);
        const clean = cleanFontFamily(family);
        if (!clean || clean === "inherit" || clean === "initial")
            continue;
        if (!fontMap[clean])
            fontMap[clean] = { weights: new Set(), tags: new Set(), count: 0 };
        fontMap[clean].weights.add("400");
        fontMap[clean].tags.add("div");
        fontMap[clean].count++;
    }
    // Parse Google Fonts
    const parsedGoogle = parseGoogleFontsUrls(googleFontsUrls);
    const googleFamilies = new Set(parsedGoogle.map(f => f.family.toLowerCase()));
    for (const gf of parsedGoogle) {
        if (fontMap[gf.family]) {
            for (const w of gf.weights)
                fontMap[gf.family].weights.add(w);
        }
        else {
            fontMap[gf.family] = { weights: new Set(gf.weights), tags: new Set(["h1"]), count: 1 };
        }
    }
    // Add @font-face families
    for (const ff of fontFaces) {
        if (!fontMap[ff.family])
            fontMap[ff.family] = { weights: new Set([ff.weight]), tags: new Set(["div"]), count: 1 };
    }
    // Build results
    const fontFaceNames = new Set(fontFaces.map(f => f.family.toLowerCase()));
    const headingTags = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
    const bodyTags = new Set(["p", "span", "li", "a", "div"]);
    const fonts = [];
    for (const [family, data] of Object.entries(fontMap)) {
        const lower = family.toLowerCase();
        let source;
        if (SYSTEM_FONTS.has(lower))
            source = "system";
        else if (googleFamilies.has(lower))
            source = "google";
        else if (hasAdobe && fontFaceNames.has(lower))
            source = "adobe";
        else
            source = "custom";
        const isHeading = [...data.tags].some(t => headingTags.has(t));
        const isBody = [...data.tags].some(t => bodyTags.has(t));
        fonts.push({
            family,
            weights: [...data.weights].sort(),
            source,
            usage: isHeading ? "heading" : isBody ? "body" : "other",
        });
    }
    // Sort: non-system first
    fonts.sort((a, b) => (a.source === "system" ? 1 : 0) - (b.source === "system" ? 1 : 0));
    const nonSystem = fonts.filter(f => f.source !== "system");
    let heading = fonts.find(f => f.usage === "heading" && f.source !== "system")
        || fonts.find(f => f.usage === "heading") || null;
    let body = fonts.find(f => f.usage === "body" && f.source !== "system")
        || fonts.find(f => f.usage === "body") || null;
    if (nonSystem.length === 1) {
        heading = heading || nonSystem[0];
        body = body || nonSystem[0];
    }
    if (!heading && nonSystem.length)
        heading = nonSystem[0];
    if (!body && nonSystem.length)
        body = nonSystem.length > 1 ? nonSystem[1] : nonSystem[0];
    return { heading, body, all: fonts, googleFontsUrls };
}
function extractLogos(html, baseUrl) {
    const logos = [];
    const seen = new Set();
    function resolveUrl(href) {
        if (!href)
            return "";
        if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
            return href.startsWith("//") ? `https:${href}` : href;
        }
        try {
            return new URL(href, baseUrl).href;
        }
        catch {
            return "";
        }
    }
    function add(href, type, sizes, mimeType) {
        const url = resolveUrl(href);
        if (!url || seen.has(url))
            return;
        seen.add(url);
        const logo = { url, type };
        if (sizes)
            logo.sizes = sizes;
        if (mimeType)
            logo.mimeType = mimeType;
        logos.push(logo);
    }
    let m;
    // SVG favicon
    const svgIconRe = /<link[^>]+rel="icon"[^>]+type="image\/svg\+xml"[^>]+href="([^"]+)"/gi;
    while ((m = svgIconRe.exec(html)) !== null)
        add(m[1], "svg-icon", undefined, "image/svg+xml");
    // Also reversed attribute order
    const svgIconRe2 = /<link[^>]+href="([^"]+)"[^>]+rel="icon"[^>]+type="image\/svg\+xml"/gi;
    while ((m = svgIconRe2.exec(html)) !== null)
        add(m[1], "svg-icon", undefined, "image/svg+xml");
    // Apple touch icon
    const appleRe = /<link[^>]+rel="apple-touch-icon(?:-precomposed)?"[^>]+href="([^"]+)"(?:[^>]+sizes="([^"]+)")?[^>]*>/gi;
    while ((m = appleRe.exec(html)) !== null)
        add(m[1], "apple-touch-icon", m[2]);
    // OG image
    const ogRe = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/gi;
    while ((m = ogRe.exec(html)) !== null)
        add(m[1], "og-image");
    const ogRe2 = /<meta[^>]+content="([^"]+)"[^>]+property="og:image"/gi;
    while ((m = ogRe2.exec(html)) !== null)
        add(m[1], "og-image");
    // Twitter image
    const twRe = /<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/gi;
    while ((m = twRe.exec(html)) !== null)
        add(m[1], "twitter-image");
    // Standard favicons
    const favRe = /<link[^>]+rel="(?:shortcut\s+)?icon"[^>]+href="([^"]+)"(?:[^>]+sizes="([^"]+)")?[^>]*>/gi;
    const favicons = [];
    while ((m = favRe.exec(html)) !== null) {
        const sizes = m[2];
        let size = 0;
        if (sizes) {
            const s = parseInt(sizes.split("x")[0]);
            if (!isNaN(s))
                size = s;
        }
        favicons.push({ href: m[1], sizes, size });
    }
    favicons.sort((a, b) => b.size - a.size);
    for (const fav of favicons)
        add(fav.href, "favicon", fav.sizes);
    // Semantic logo: images with "logo" or "brand" in attributes
    const imgRe = /<img[^>]+(?:src|alt|class|id)[^>]*>/gi;
    let semanticCount = 0;
    while ((m = imgRe.exec(html)) !== null && semanticCount < 3) {
        const tag = m[0].toLowerCase();
        if (tag.includes("logo") || tag.includes("brand")) {
            const srcMatch = tag.match(/src="([^"]+)"/);
            if (srcMatch) {
                add(srcMatch[1], "semantic-logo");
                semanticCount++;
            }
        }
    }
    // Header/nav images
    const headerImgRe = /<(?:header|nav)[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>/i;
    const headerMatch = html.match(headerImgRe);
    if (headerMatch)
        add(headerMatch[1], "semantic-logo");
    // Fallback: /favicon.ico
    add("/favicon.ico", "favicon");
    return logos;
}
/**
 * Fetch logo images and embed as base64 data URIs.
 * Runs in Node.js (uses fetch API).
 */
async function fetchLogoData(logos, maxLogos = 6) {
    const results = [];
    let fetched = 0;
    for (const logo of logos) {
        if (fetched >= maxLogos) {
            results.push(logo);
            continue;
        }
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const origin = new URL(logo.url).origin;
            const res = await fetch(logo.url, {
                signal: controller.signal,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "image/*,*/*",
                    "Referer": origin + "/",
                },
            });
            clearTimeout(timeout);
            if (!res.ok) {
                results.push(logo);
                continue;
            }
            const buf = await res.arrayBuffer();
            if (buf.byteLength < 10) {
                results.push(logo);
                continue;
            }
            const contentType = res.headers.get("content-type") || "image/png";
            const b64 = Buffer.from(buf).toString("base64");
            results.push({
                ...logo,
                mimeType: logo.mimeType || contentType,
                data: `data:${contentType};base64,${b64}`,
            });
            fetched++;
        }
        catch {
            results.push(logo);
        }
    }
    return results;
}
/**
 * Extract brand data (colors, fonts, logos) from HTML.
 * Does NOT require a browser or AI — pure regex-based parsing.
 * For best results, pass full rendered HTML from crawl4ai.
 */
function extractBrandData(html, pageUrl) {
    return {
        colors: extractColors(html),
        fonts: extractFonts(html),
        logos: extractLogos(html, pageUrl),
    };
}
/**
 * Full extraction with logo fetching (async).
 * Fetches logo images and embeds them as base64 data URIs.
 */
async function extractBrandDataFull(html, pageUrl) {
    const data = extractBrandData(html, pageUrl);
    data.logos = await fetchLogoData(data.logos);
    return data;
}
//# sourceMappingURL=brand-extractor.js.map