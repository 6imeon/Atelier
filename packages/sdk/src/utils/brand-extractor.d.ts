/**
 * Brand Extractor — TypeScript port of BrandExtractor/Marque
 * Extracts colors, fonts, and logos from HTML + CSS without AI.
 * Uses regex-based CSS parsing (no browser DOM needed).
 */
export declare function rgbToHex(r: number, g: number, b: number): string;
export declare function hexToRgb(hex: string): {
    r: number;
    g: number;
    b: number;
} | null;
export declare function rgbToHsl(r: number, g: number, b: number): {
    h: number;
    s: number;
    l: number;
};
export interface ColorInfo {
    hex: string;
    rgb: {
        r: number;
        g: number;
        b: number;
    };
    hsl: {
        h: number;
        s: number;
        l: number;
    };
    source: "css" | "logo" | "visual";
}
export interface ExtractedColors {
    primary: ColorInfo | null;
    secondary: ColorInfo | null;
    accent: ColorInfo | null;
    background: ColorInfo | null;
    text: ColorInfo | null;
    all: ColorInfo[];
}
export declare function extractColors(html: string, stylesheets?: string[]): ExtractedColors;
export interface ExtractedFont {
    family: string;
    weights: string[];
    source: "google" | "adobe" | "custom" | "system";
    usage: "heading" | "body" | "other";
}
export interface ExtractedFonts {
    heading: ExtractedFont | null;
    body: ExtractedFont | null;
    all: ExtractedFont[];
    googleFontsUrls: string[];
}
export declare function extractFonts(html: string): ExtractedFonts;
export interface ExtractedLogo {
    url: string;
    type: "svg-icon" | "apple-touch-icon" | "og-image" | "twitter-image" | "favicon" | "semantic-logo";
    sizes?: string;
    mimeType?: string;
    data?: string;
}
export declare function extractLogos(html: string, baseUrl: string): ExtractedLogo[];
/**
 * Fetch logo images and embed as base64 data URIs.
 * Runs in Node.js (uses fetch API).
 */
export declare function fetchLogoData(logos: ExtractedLogo[], maxLogos?: number): Promise<ExtractedLogo[]>;
export interface BrandData {
    colors: ExtractedColors;
    fonts: ExtractedFonts;
    logos: ExtractedLogo[];
}
/**
 * Extract brand data (colors, fonts, logos) from HTML.
 * Does NOT require a browser or AI — pure regex-based parsing.
 * For best results, pass full rendered HTML from crawl4ai.
 */
export declare function extractBrandData(html: string, pageUrl: string): BrandData;
/**
 * Full extraction with logo fetching (async).
 * Fetches logo images and embeds them as base64 data URIs.
 */
export declare function extractBrandDataFull(html: string, pageUrl: string): Promise<BrandData>;
