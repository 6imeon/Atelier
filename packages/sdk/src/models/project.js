"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
const screen_js_1 = require("./screen.js");
const router_js_1 = require("../utils/router.js");
const prompts_js_1 = require("../utils/prompts.js");
const brand_extractor_js_1 = require("../utils/brand-extractor.js");
class Project {
    id;
    title;
    _designSystem;
    _screens;
    _componentLibrary = null;
    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this._designSystem = data.designSystem ?? null;
        this._screens = new Map();
        for (const s of data.screens ?? [])
            this._screens.set(s.id, new screen_js_1.Screen(s));
    }
    async screens() { return [...this._screens.values()]; }
    async getScreen(id) { return this._screens.get(id) ?? null; }
    getDesignSystem() { return this._designSystem; }
    setDesignSystem(ds) { this._designSystem = ds; }
    getComponentLibrary() { return this._componentLibrary; }
    setComponentLibrary(lib) { this._componentLibrary = lib; }
    /**
     * Fetch a page using crawl4ai (if available) with fallback to direct fetch.
     * crawl4ai uses a headless browser so it can bypass bot protection.
     */
    async _fetchPage(url) {
        const crawl4aiUrl = process.env.CRAWL4AI_URL;
        // Try crawl4ai first
        if (crawl4aiUrl) {
            try {
                console.log(`[sdk] Fetching via crawl4ai: ${url}`);
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 60_000);
                const res = await fetch(`${crawl4aiUrl}/crawl`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: controller.signal,
                    body: JSON.stringify({ urls: [url], word_count_threshold: 10 }),
                });
                clearTimeout(timeout);
                if (res.ok) {
                    const data = await res.json();
                    const result = data.results?.[0] ?? data;
                    // crawl4ai v0.8+ may return markdown as an object — coerce to string
                    const rawMd = result.markdown ?? result.extracted_content ?? "";
                    const md = typeof rawMd === "string" ? rawMd : (rawMd?.raw_markdown ?? rawMd?.fit_markdown ?? JSON.stringify(rawMd) ?? "");
                    const rawHtml = result.html ?? result.raw_html ?? "";
                    const html = typeof rawHtml === "string" ? rawHtml : "";
                    if (md || html) {
                        console.log(`[sdk] crawl4ai success: ${md.length} chars markdown, ${html.length} chars html`);
                        return { html, markdown: md, fromCrawl4ai: true };
                    }
                }
                console.warn(`[sdk] crawl4ai returned no content, falling back to direct fetch`);
            }
            catch (err) {
                console.warn(`[sdk] crawl4ai unavailable: ${err instanceof Error ? err.message : err}`);
            }
        }
        // Fallback: direct fetch
        try {
            console.log(`[sdk] Direct fetch: ${url}`);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15_000);
            const res = await fetch(url, {
                signal: controller.signal,
                headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
            });
            clearTimeout(timeout);
            const html = await res.text();
            console.log(`[sdk] Direct fetch: ${html.length} chars`);
            return { html, markdown: "", fromCrawl4ai: false };
        }
        catch (err) {
            console.warn(`[sdk] Direct fetch failed: ${err instanceof Error ? err.message : err}`);
            return { html: "", markdown: "", fromCrawl4ai: false };
        }
    }
    /**
     * Check if fetched HTML is a bot challenge/empty shell rather than real content.
     */
    _isBlocked(html) {
        if (!html)
            return true;
        const blocked = ["Challenge Validation", "captcha", "cf-browser-verification", "Just a moment", "Checking your browser"];
        if (blocked.some(s => html.includes(s)))
            return true;
        const textOnly = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "").trim();
        return textOnly.length < 200;
    }
    /**
     * Strip non-content HTML elements, keeping structure and text.
     */
    _stripHtml(html, maxLen = 12_000) {
        return html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<svg[\s\S]*?<\/svg>/gi, "")
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
            .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/<img[^>]*>/gi, (match) => {
            const alt = match.match(/alt="([^"]*)"/)?.[1] || "";
            return alt ? `[image: ${alt}]` : "";
        })
            .replace(/\s{2,}/g, " ")
            .replace(/>\s+</g, ">\n<")
            .slice(0, maxLen);
    }
    /**
     * Extract plain text content from HTML.
     */
    _extractText(html, maxLen = 4000) {
        return html
            .replace(/<[^>]+>/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, maxLen);
    }
    /**
     * Extract brand/company name from HTML title tag or meta tags.
     * Falls back to domain-based guess.
     */
    _extractBrandName(html, url) {
        // Try <title> tag first
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            let title = titleMatch[1].trim();
            // Strip common suffixes like " | Home", " - Homepage", " — Official Site"
            title = title.replace(/\s*[|–—-]\s*(home|homepage|official|welcome|main).*/i, "").trim();
            // If title is reasonable length, use it
            if (title.length > 1 && title.length < 60)
                return title;
        }
        // Try og:site_name meta tag
        const ogMatch = html.match(/<meta[^>]*property="og:site_name"[^>]*content="([^"]+)"/i);
        if (ogMatch)
            return ogMatch[1].trim();
        // Fallback: domain-based extraction
        const domain = new URL(url).hostname.replace("www.", "");
        // Handle multi-part TLDs like .co.uk, .com.au
        const parts = domain.split(".");
        let name = parts[0];
        if (parts.length > 2 && ["co", "com", "org", "net"].includes(parts[parts.length - 2])) {
            name = parts.slice(0, -2).join(".");
        }
        else if (parts.length > 1) {
            name = parts.slice(0, -1).join(".");
        }
        // Split on hyphens and try to detect camelCase
        return name
            .split(/[-_]/)
            .map(w => {
            // Try to split camelCase or concatenated words (e.g., "strattoncraig" → leave as-is, capitalize)
            return w.charAt(0).toUpperCase() + w.slice(1);
        })
            .join(" ");
    }
    async generate(prompt, deviceType = "DESKTOP", onProgress) {
        const router = (0, router_js_1.getRouter)();
        const lib = this._componentLibrary;
        const hasComponents = lib && lib.all().length > 0;
        onProgress?.("Analyzing prompt...");
        const intent = await router.routeJSON("intent_parse", [
            { role: "system", content: prompts_js_1.PROMPTS.INTENT_SYSTEM },
            { role: "user", content: prompt },
        ]);
        // Hybrid path: select components from library if available
        let componentContext = "";
        if (hasComponents) {
            onProgress?.("Selecting components...", `${lib.all().length} components in library`);
            try {
                const selection = await lib.selectForPrompt(prompt);
                componentContext = lib.toPromptContext(selection);
                // Track usage
                for (const { component } of selection.matched)
                    lib.recordUsage(component.id);
                console.log(`[sdk] Selected ${selection.matched.length} components, ${selection.gaps.length} gaps`);
            }
            catch (err) {
                console.warn(`[sdk] Component selection failed, falling back to pure generation:`, err);
            }
        }
        onProgress?.("Generating layout...", hasComponents ? "Assembling from library + AI" : "This may take a minute");
        const systemPrompt = componentContext ? prompts_js_1.PROMPTS.HYBRID_ASSEMBLY_SYSTEM : prompts_js_1.PROMPTS.LAYOUT_SYSTEM;
        const userContent = componentContext
            ? `${componentContext}\n=== PAGE REQUEST ===\n${prompt}\n\n=== DESIGN SYSTEM ===\n${JSON.stringify(this._designSystem)}\n\nDevice: ${deviceType}`
            : JSON.stringify({ intent, designSystem: this._designSystem, deviceType });
        const result = await router.routeJSON("layout_generate", [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
        ]);
        onProgress?.("Complete!");
        const id = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const screen = new screen_js_1.Screen({
            id, projectId: this.id, prompt, html: result.html, deviceType,
            componentTree: result.componentTree,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
        this._screens.set(id, screen);
        return screen;
    }
    async generateFromImage(imageBase64, prompt = "", deviceType = "DESKTOP") {
        const router = (0, router_js_1.getRouter)();
        const vis = await router.routeJSON("vision_interpret", [{
                role: "user",
                content: [
                    { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
                    { type: "text", text: prompt ? `Analyze this UI. Context: ${prompt}` : "Analyze this UI in detail." },
                ],
            }]);
        let intent = {};
        if (prompt) {
            intent = await router.routeJSON("intent_parse", [
                { role: "system", content: prompts_js_1.PROMPTS.INTENT_SYSTEM },
                { role: "user", content: prompt },
            ]);
        }
        const result = await router.routeJSON("layout_generate", [
            { role: "system", content: prompts_js_1.PROMPTS.LAYOUT_SYSTEM },
            { role: "user", content: JSON.stringify({ intent, visualContext: vis, designSystem: this._designSystem, deviceType }) },
        ]);
        const id = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const screen = new screen_js_1.Screen({
            id, projectId: this.id, prompt: prompt || "[from image]", html: result.html,
            deviceType, componentTree: result.componentTree,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
        this._screens.set(id, screen);
        return screen;
    }
    async redesignFromURL(url, prompt, deviceType = "DESKTOP", onProgress) {
        const router = (0, router_js_1.getRouter)();
        onProgress?.("Fetching page...", url);
        const fetched = await this._fetchPage(url);
        // Determine if we got real content
        let fetchSucceeded = false;
        let textContent = "";
        let stripped = "";
        if (fetched.fromCrawl4ai && fetched.markdown) {
            // crawl4ai returned clean markdown — best case
            fetchSucceeded = true;
            textContent = fetched.markdown.slice(0, 6000);
            stripped = this._stripHtml(fetched.html);
        }
        else if (!this._isBlocked(fetched.html)) {
            // Direct fetch got real content
            fetchSucceeded = true;
            stripped = this._stripHtml(fetched.html);
            textContent = this._extractText(stripped);
        }
        onProgress?.("Analyzing content...");
        // Extract brand name from page content or URL
        const domain = new URL(url).hostname.replace("www.", "");
        const brandGuess = this._extractBrandName(fetched.html || "", url);
        console.log(`[sdk] Brand name: "${brandGuess}" (from ${domain})`);
        // Extract brand data (colors, fonts, logos) using real CSS/HTML parsing
        let extractedDesign = {};
        let brandData = null;
        if (fetchSucceeded && (fetched.html || stripped)) {
            try {
                onProgress?.("Extracting brand colors, fonts & logos...");
                const htmlForExtraction = fetched.html || stripped;
                console.log(`[sdk] Extracting brand data from ${htmlForExtraction.length} chars of HTML...`);
                brandData = await (0, brand_extractor_js_1.extractBrandDataFull)(htmlForExtraction, url);
                // Convert to design tokens format for backward compatibility
                extractedDesign = {
                    colors: {
                        primary: brandData.colors.primary?.hex || null,
                        secondary: brandData.colors.secondary?.hex || null,
                        accent: brandData.colors.accent?.hex || null,
                        background: brandData.colors.background?.hex || null,
                        text: brandData.colors.text?.hex || null,
                    },
                    typography: {
                        fontFamilies: {
                            heading: brandData.fonts.heading?.family || null,
                            body: brandData.fonts.body?.family || null,
                        },
                        googleFontsUrls: brandData.fonts.googleFontsUrls,
                    },
                    logos: brandData.logos.filter(l => l.data).slice(0, 4),
                    _brandData: brandData, // Full brand data for the frontend
                };
                console.log(`[sdk] Brand data extracted: ${brandData.colors.all.length} colors, ${brandData.fonts.all.length} fonts, ${brandData.logos.length} logos`);
            }
            catch (err) {
                console.warn(`[sdk] Brand extraction failed: ${err instanceof Error ? err.message : err}`);
            }
        }
        else {
            console.log(`[sdk] Skipping brand extraction (fetchSucceeded=${fetchSucceeded})`);
        }
        // Build the prompt
        const systemPrompt = fetchSucceeded
            ? `You are redesigning an existing webpage. You MUST preserve the original content exactly.

ABSOLUTE RULES — VIOLATION MEANS FAILURE:
- The company/brand name is "${brandGuess}" (from ${domain}). Use this EXACT name. Do NOT invent a different name.
- Use the EXACT navigation menu items, headings, taglines, and body copy from the source below.
- Do NOT create fictional content — every piece of text must come from the source.
- The page must be FULL LENGTH with ALL sections from the original (6+ sections minimum).

DESIGN RULES:
- Include <script src="https://cdn.tailwindcss.com"></script>
- Include Google Fonts via <link> tags
- Use https://picsum.photos/WIDTH/HEIGHT?random=N for images (vary N)
- Modern design: generous whitespace, clear hierarchy, hover effects, smooth transitions
- Return ONLY raw HTML starting with <!DOCTYPE html> — no JSON, no markdown fences, no explanation`
            : `You are redesigning a webpage for "${brandGuess}" (${url}).
Since the site could not be directly fetched (bot protection), use your knowledge of the brand and the user's instructions to create a professional redesign.

RULES:
- The company name is "${brandGuess}". Use this EXACT name throughout.
- Research what you know about this company and create a realistic page with appropriate content.
- The page must be FULL LENGTH with a hero, about, services, case studies/portfolio, team/testimonials, CTA, and footer (6+ sections).
- Include <script src="https://cdn.tailwindcss.com"></script>
- Include Google Fonts via <link> tags
- Use https://picsum.photos/WIDTH/HEIGHT?random=N for placeholder images (vary N)
- Modern, polished design: generous whitespace, clear hierarchy, hover effects
- Return ONLY raw HTML starting with <!DOCTYPE html> — no JSON, no markdown fences, no explanation`;
        const userMsg = fetchSucceeded
            ? `REDESIGN THIS PAGE: ${url}

=== ORIGINAL TEXT CONTENT (use EXACTLY) ===
${textContent}

=== ORIGINAL HTML STRUCTURE ===
${stripped}

=== EXTRACTED DESIGN TOKENS ===
${JSON.stringify(extractedDesign, null, 2)}

=== USER INSTRUCTIONS ===
${prompt}`
            : `Create a redesigned homepage for ${brandGuess} (${url}).

The site has bot protection so I couldn't fetch the HTML. Use your knowledge of this company/brand.
${prompt}`;
        onProgress?.("Generating redesign...", "This is the slow step — the AI is writing the full page");
        const result = await router.routeJSON("layout_generate", [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMsg },
        ]);
        onProgress?.("Complete!");
        result.designTokens = { ...extractedDesign, brandName: brandGuess };
        const id = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const screen = new screen_js_1.Screen({
            id, projectId: this.id, prompt, html: result.html, deviceType,
            componentTree: result.componentTree, designTokens: result.designTokens,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
        this._screens.set(id, screen);
        return screen;
    }
    /**
     * Plan a redesign: analyze the site and propose pages + design system name.
     * Returns a structured plan without generating any HTML.
     */
    async planRedesign(url, userPrompt, onProgress) {
        const router = (0, router_js_1.getRouter)();
        onProgress?.("Capturing a reference...", url);
        const fetched = await this._fetchPage(url);
        let fetchSucceeded = false;
        let textContent = "";
        let stripped = "";
        if (fetched.fromCrawl4ai && fetched.markdown) {
            fetchSucceeded = true;
            textContent = (typeof fetched.markdown === "string" ? fetched.markdown : "").slice(0, 6000);
            stripped = this._stripHtml(fetched.html);
        }
        else if (!this._isBlocked(fetched.html)) {
            fetchSucceeded = true;
            stripped = this._stripHtml(fetched.html);
            textContent = this._extractText(stripped);
        }
        const brandName = this._extractBrandName(fetched.html || "", url);
        onProgress?.("Extracting brand colors, fonts & logos...");
        // Extract brand data using real CSS/HTML parsing (no AI)
        let designTokens = {};
        if (fetchSucceeded && (fetched.html || stripped)) {
            try {
                const htmlForExtraction = fetched.html || stripped;
                const brandData = await (0, brand_extractor_js_1.extractBrandDataFull)(htmlForExtraction, url);
                designTokens = {
                    colors: {
                        primary: brandData.colors.primary?.hex || null,
                        secondary: brandData.colors.secondary?.hex || null,
                        accent: brandData.colors.accent?.hex || null,
                        background: brandData.colors.background?.hex || null,
                        text: brandData.colors.text?.hex || null,
                    },
                    typography: {
                        fontFamilies: {
                            heading: brandData.fonts.heading?.family || null,
                            body: brandData.fonts.body?.family || null,
                        },
                        googleFontsUrls: brandData.fonts.googleFontsUrls,
                    },
                    logos: brandData.logos.filter(l => l.data).slice(0, 4),
                    _brandData: brandData,
                };
                console.log(`[sdk] planRedesign brand data: ${brandData.colors.all.length} colors, ${brandData.fonts.all.length} fonts, ${brandData.logos.length} logos`);
            }
            catch (err) {
                console.warn(`[sdk] planRedesign brand extraction failed:`, err);
            }
        }
        onProgress?.("Mapping out the components...");
        // AI plans the redesign: analyzes the brand and proposes pages
        const plan = await router.routeJSON("intent_parse", [
            { role: "system", content: `You are a senior UI/UX designer planning a website redesign. Analyze the brand and propose a set of pages to redesign.

Return JSON:
{
  "designSystemName": "A creative 2-word theme name for the design system (e.g., 'Editorial Prestige', 'Bold Navigator', 'Minimal Luxe')",
  "analysis": "2-3 sentences analyzing the brand's current identity, tone, and audience",
  "pages": [
    { "title": "Homepage", "description": "A bold, high-impact hero section that clearly states their value proposition, followed by..." },
    { "title": "Services Overview", "description": "..." },
    ...
  ]
}

Propose 3-5 pages that make sense for the type of business. Always include a Homepage. Common pages: Services, About, Case Studies, Blog/Insights, Contact, Portfolio, Pricing.
If the user specifies which pages they want (e.g., "only the homepage"), respect that and only propose those pages.
If the user gives style/branding instructions (e.g., "keep their colours"), note that in your analysis.` },
            { role: "user", content: `Plan a redesign for ${brandName} (${url}).
${userPrompt ? `\nUser instructions: ${userPrompt}` : ""}
${fetchSucceeded ? `\nSite content:\n${textContent.slice(0, 3000)}` : "\nCould not fetch site content — use your knowledge of the brand."}` },
        ]);
        return {
            brandName,
            designSystemName: plan.designSystemName || "Design System",
            analysis: plan.analysis || "",
            proposedPages: plan.pages || [{ title: "Homepage", description: "A complete homepage redesign" }],
            designTokens: { ...designTokens, brandName: plan.designSystemName || brandName },
            fetchedContent: { textContent, stripped, fetchSucceeded },
        };
    }
    /**
     * Generate a single page as part of a multi-page redesign.
     * Uses pre-fetched content from planRedesign() to avoid re-crawling.
     */
    async generatePage(url, pageTitle, pageDescription, brandName, fetchedContent, designTokens, deviceType = "DESKTOP", onProgress) {
        const router = (0, router_js_1.getRouter)();
        const domain = new URL(url).hostname.replace("www.", "");
        const { textContent, stripped, fetchSucceeded } = fetchedContent;
        onProgress?.(`Generating ${pageTitle}...`);
        const systemPrompt = fetchSucceeded
            ? `You are redesigning the "${pageTitle}" page for "${brandName}" (${domain}).

RULES:
- The company name is "${brandName}". Use this EXACT name.
- Use content from the source site where relevant. Do NOT invent facts about the company.
- This is the ${pageTitle} page: ${pageDescription}
- Create a well-proportioned page with appropriate sections for a ${pageTitle.toLowerCase()} page. Avoid excessive white space or empty filler sections.
- Include <script src="https://cdn.tailwindcss.com"></script>
- Include Google Fonts via <link> tags
- Use https://picsum.photos/WIDTH/HEIGHT?random=N for images (vary N)
- Modern design: clear hierarchy, hover effects, smooth transitions. Keep sections compact and content-dense.
- Return ONLY raw HTML starting with <!DOCTYPE html>`
            : `You are designing the "${pageTitle}" page for "${brandName}" (${url}).
The site couldn't be fetched. Use your knowledge of the brand.

RULES:
- Company name: "${brandName}". Use this EXACT name.
- This is the ${pageTitle} page: ${pageDescription}
- Well-proportioned page with appropriate sections for ${pageTitle.toLowerCase()}. Avoid excessive white space.
- Include <script src="https://cdn.tailwindcss.com"></script>
- Include Google Fonts via <link> tags
- Use https://picsum.photos/WIDTH/HEIGHT?random=N for images
- Modern, polished, compact design — content-dense, no filler
- Return ONLY raw HTML starting with <!DOCTYPE html>`;
        const userMsg = fetchSucceeded
            ? `Create the ${pageTitle} page for ${brandName}.

=== SOURCE CONTENT ===
${textContent.slice(0, 4000)}

=== DESIGN TOKENS ===
${JSON.stringify(designTokens, null, 2)}

Page description: ${pageDescription}`
            : `Create the ${pageTitle} page for ${brandName} (${url}).
${pageDescription}`;
        const result = await router.routeJSON("layout_generate", [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMsg },
        ]);
        const id = `scr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const screen = new screen_js_1.Screen({
            id, projectId: this.id, prompt: `${brandName} — ${pageTitle}`,
            html: result.html, deviceType,
            designTokens,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        });
        this._screens.set(id, screen);
        return screen;
    }
    async extractDesignFromURL(url) {
        const fetched = await this._fetchPage(url);
        const html = fetched.html;
        if (!html || this._isBlocked(html)) {
            throw new Error(`Could not fetch content from ${url}. The site may have bot protection.`);
        }
        const brandData = await (0, brand_extractor_js_1.extractBrandDataFull)(html, url);
        return {
            colors: {
                primary: brandData.colors.primary?.hex || null,
                secondary: brandData.colors.secondary?.hex || null,
                accent: brandData.colors.accent?.hex || null,
                background: brandData.colors.background?.hex || null,
                text: brandData.colors.text?.hex || null,
            },
            typography: {
                fontFamilies: {
                    heading: brandData.fonts.heading?.family || null,
                    body: brandData.fonts.body?.family || null,
                },
            },
            logos: brandData.logos.filter(l => l.data).slice(0, 4),
            _brandData: brandData,
        };
    }
    toJSON() {
        return {
            id: this.id, title: this.title, designSystem: this._designSystem ?? undefined,
            screens: [...this._screens.values()].map(s => s.toJSON()),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
    }
}
exports.Project = Project;
//# sourceMappingURL=project.js.map