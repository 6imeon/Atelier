import { route, authenticate, rateLimit, body, json, validateRequired, validateExternalUrl, setupSSE, sdk, storage, componentLibrary, analytics, VALID_DEVICE_TYPES, PORT } from "../shared";
import { getRouter, PROMPTS, assembleSections, extractConsistencyConstraints, createPipelineRun } from "@canvas-ai/sdk";
import type { ConsistencyConstraints } from "@canvas-ai/sdk";

export function registerScreenRoutes() {
  route("POST", "/api/projects/:pid/screens/generate", async (req, res, params) => {
    await authenticate(req);
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["prompt"]);
    const deviceType = VALID_DEVICE_TYPES.includes(b.deviceType) ? b.deviceType : "DESKTOP";
    const project = sdk.project(params.pid);
    if (componentLibrary.all().length > 0) project.setComponentLibrary(componentLibrary);

    if (b.designSystem && typeof b.designSystem === "object") {
      const ds = b.designSystem;
      const colors = ds.colors || {};
      const fonts = ds.fonts || {};
      project.setDesignSystem({
        colors: {
          primary: colors.primary || "#6366f1",
          secondary: colors.secondary || "#a5b4fc",
          accent: colors.tertiary || "#818cf8",
          background: colors.background || "#ffffff",
          surface: colors.neutral || "#f3f4f6",
          text: { primary: colors.text || "#111827", secondary: "#4b5563", muted: "#9ca3af" },
        },
        typography: {
          fontFamilies: { heading: fonts.headline || "Inter", body: fonts.body || "Inter", mono: "JetBrains Mono" },
          scale: { xs: "0.75rem", sm: "0.875rem", base: "1rem", lg: "1.125rem", xl: "1.25rem", "2xl": "1.5rem", "3xl": "1.875rem", "4xl": "2.25rem" },
        },
        spacing: { unit: "4px", scale: ["4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px"] },
        borderRadius: { sm: "4px", md: ds.cornerRadius || "8px", lg: "12px", full: "9999px" },
        shadows: { sm: "0 1px 2px rgba(0,0,0,0.05)", md: "0 4px 12px rgba(0,0,0,0.1)", lg: "0 8px 24px rgba(0,0,0,0.15)" },
        componentPatterns: [],
      });
    }

    const sendEvent = setupSSE(req, res);
    const onProgress = (stage: string, detail?: string) => sendEvent("progress", { stage, detail });

    const logger = createPipelineRun();
    try {
      if (b.sourceUrl && typeof b.sourceUrl === "string" && /^https?:\/\//.test(b.sourceUrl)) {
        validateExternalUrl(b.sourceUrl);
        logger.phase("REDESIGN", b.sourceUrl);
        const s = await project.redesignFromURL(b.sourceUrl, b.prompt, deviceType, onProgress, b.premiumScroll, logger);
        const data = s.toJSON();
        const html = await s.getHtml();
        if (storage) await storage.createScreen(params.pid, { id: s.id, projectId: params.pid, prompt: b.prompt, html, deviceType, designTokens: data.designTokens, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        sendEvent("complete", { screenId: s.id, html, designTokens: data.designTokens });
      } else {
        logger.phase("GENERATE", "from prompt");
        const s = await project.generate(b.prompt, deviceType, onProgress, logger);
        const html = await s.getHtml();
        if (storage) await storage.createScreen(params.pid, { id: s.id, projectId: params.pid, prompt: b.prompt, html, deviceType, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        sendEvent("complete", { screenId: s.id, html });
      }
    } catch (err: any) {
      sendEvent("error", { error: err.message });
    }
    res.end();
  });

  route("POST", "/api/projects/:pid/redesign/plan", async (req, res, params) => {
    await authenticate(req);
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["url"]);
    validateExternalUrl(b.url);
    const project = sdk.project(params.pid);
    const sendEvent = setupSSE(req, res);

    const logger = createPipelineRun();
    try {
      const plan = await project.planRedesign(b.url, b.prompt || "", (stage: string, detail?: string) => {
        sendEvent("progress", { stage, detail });
      }, logger);
      sendEvent("complete", { plan });
    } catch (err: any) {
      sendEvent("error", { error: err.message });
    }
    res.end();
  });

  route("POST", "/api/projects/:pid/redesign/generate", async (req, res, params) => {
    await authenticate(req);
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["url", "pages", "brandName", "designTokens", "fetchedContent"]);
    validateExternalUrl(b.url);
    const deviceType = VALID_DEVICE_TYPES.includes(b.deviceType) ? b.deviceType : "DESKTOP";
    const project = sdk.project(params.pid);
    if (componentLibrary.all().length > 0) project.setComponentLibrary(componentLibrary);

    const sendEvent = setupSSE(req, res);
    const pages = b.pages as Array<{ title: string; description: string }>;
    sendEvent("progress", { stage: `Generating ${pages.length} pages...`, detail: `Applying design system to the screens (0/${pages.length})` });

    const logger = createPipelineRun();
    try {
      let consistency: ConsistencyConstraints | undefined;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        sendEvent("progress", { stage: `Generating ${page.title}...`, detail: `Applying design system to the screens (${i}/${pages.length})` });

        const screen = await project.generatePageSectioned(
          b.url, page.title, page.description,
          b.brandName, b.fetchedContent, b.designTokens,
          deviceType,
          (stage: string, detail?: string) => sendEvent("progress", { stage, detail }),
          consistency,
          b.premiumScroll,
          logger,
        );

        const screenHtml = await screen.getHtml();

        if (i === 0 && pages.length > 1) {
          consistency = extractConsistencyConstraints(screenHtml);
          logger.info(`Consistency constraints: nav=${!!consistency.navHtml}, footer=${!!consistency.footerHtml}, button=${!!consistency.buttonClasses}`);
        }

        if (storage) await storage.createScreen(params.pid, { id: screen.id, projectId: params.pid, prompt: `${page.title}: ${page.description}`, html: screenHtml, deviceType, designTokens: b.designTokens, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

        sendEvent("screen", {
          index: i, total: pages.length, screenId: screen.id,
          title: page.title, html: screenHtml, designTokens: b.designTokens,
        });
      }
      sendEvent("complete", { totalScreens: pages.length });
    } catch (err: any) {
      sendEvent("error", { error: err.message });
    }
    res.end();
  });

  route("POST", "/api/projects/:pid/screens/from-image", async (req, res, params) => {
    await authenticate(req);
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["imageBase64"]);
    const deviceType = VALID_DEVICE_TYPES.includes(b.deviceType) ? b.deviceType : "DESKTOP";
    const s = await sdk.project(params.pid).generateFromImage(b.imageBase64, b.prompt ?? "", deviceType);
    const html = await s.getHtml();
    if (storage) await storage.createScreen(params.pid, { id: s.id, projectId: params.pid, prompt: b.prompt ?? "from-image", html, deviceType, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    json(res, { screenId: s.id, html }, 201);
  });

  route("POST", "/api/projects/:pid/screens/:sid/edit", async (req, res, params) => {
    await authenticate(req);
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["prompt"]);

    if (typeof b.currentHtml !== "string" || b.currentHtml.length === 0) {
      const scr = await sdk.project(params.pid).getScreen(params.sid);
      if (!scr) { json(res, { error: "Screen not found. Pass currentHtml in the request body." }, 404); return; }
      const ed = await scr.edit(b.prompt);
      json(res, { screenId: ed.id, html: await ed.getHtml() }, 201);
      return;
    }

    const router = getRouter();

    if (b.sectionSelector && typeof b.sectionSelector === "string") {
      const fullHtml = b.currentHtml as string;
      const sectionHtml = extractSectionHtml(fullHtml, b.sectionSelector);

      if (sectionHtml) {
        console.log(`[api] Section edit: ${b.sectionSelector} (${sectionHtml.length} chars)`);
        const result = await router.routeJSON("design_refine", [
          { role: "system", content: PROMPTS.REFINE_SECTION_SYSTEM },
          { role: "user", content: JSON.stringify({
            sectionHtml,
            elementSelector: b.elementSelector || "",
            elementTag: b.elementTag || "",
            editRequest: b.prompt,
            deviceType: b.deviceType || "DESKTOP",
          }) },
        ]) as { html: string };

        if (result.html) {
          const sectionIdx = fullHtml.indexOf(sectionHtml);
          if (sectionIdx !== -1) {
            const updatedFull = fullHtml.slice(0, sectionIdx) + result.html + fullHtml.slice(sectionIdx + sectionHtml.length);
            console.log(`[api] Section splice successful (${result.html.length} chars replaced at index ${sectionIdx})`);
            if (storage) await storage.updateScreen(params.pid, params.sid, { html: updatedFull });
            json(res, { screenId: params.sid, html: updatedFull }, 200);
            return;
          }
          console.warn(`[api] Section splice failed — section not found at expected position, falling back to full-page edit`);
        }
      } else {
        console.warn(`[api] Could not extract section "${b.sectionSelector}" — falling back to full-page edit`);
      }
    }

    let htmlForEdit = b.currentHtml as string;
    if (/variant/i.test(b.prompt)) {
      htmlForEdit = htmlForEdit
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<link[^>]*>/gi, "");
      console.log(`[api] Variant edit: stripped scripts/styles (${(b.currentHtml as string).length} → ${htmlForEdit.length} chars)`);
    }
    const result = await router.routeJSON("design_refine", [
      { role: "system", content: PROMPTS.REFINE_SYSTEM },
      { role: "user", content: JSON.stringify({ currentHtml: htmlForEdit, editRequest: b.prompt, deviceType: b.deviceType || "DESKTOP" }) },
    ]) as { html: string };

    if (!result.html || typeof result.html !== "string" || result.html.trim().length < 50) {
      console.error(`[api] Edit returned empty/invalid HTML (${result.html?.length ?? 0} chars)`);
      json(res, { error: "Edit failed — AI returned empty or invalid HTML. Please try again." }, 500);
      return;
    }
    if (storage) await storage.updateScreen(params.pid, params.sid, { html: result.html });
    json(res, { screenId: params.sid, html: result.html }, 200);
  });

  route("POST", "/api/projects/:pid/screens/:sid/variants", async (req, res, params) => {
    await authenticate(req);
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["prompt"]);

    const fullHtml = b.currentHtml as string;
    if (!fullHtml || fullHtml.length < 50) {
      json(res, { error: "currentHtml is required for variant generation" }, 400);
      return;
    }

    const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : fullHtml;
    const sectionRegex = /<(section|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi;
    const sections: string[] = [];
    let match;
    while ((match = sectionRegex.exec(bodyContent)) !== null) {
      const cleaned = match[0]
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "");
      if (cleaned.length > 50) sections.push(cleaned);
    }

    if (sections.length === 0) {
      json(res, { error: "Could not extract sections from HTML" }, 400);
      return;
    }

    console.log(`[api] Variant: ${sections.length} sections extracted, generating variant section-by-section`);
    const router = getRouter();
    const variantSections: string[] = [];
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const trimmed = section.length > 6000 ? section.slice(0, 6000) : section;
      try {
        console.log(`[api] Variant section ${i + 1}/${sections.length} (${trimmed.length} chars)`);
        const result = await router.routeJSON<{ html: string }>("section_generate", [
          { role: "system", content: PROMPTS.SECTION_GENERATE_SYSTEM },
          { role: "user", content: `Create a VARIANT of this section. Keep the same content and purpose but redesign the layout, spacing, and visual approach. Make it look distinctly different while maintaining the same brand colors and content.\n\n<current-section>\n${trimmed}\n</current-section>\n\nReturn ONLY the redesigned section HTML.` },
        ]);
        let sectionHtml = result.html || "";
        sectionHtml = sectionHtml.replace(/^```html?\s*/i, "").replace(/```\s*$/, "").trim();
        console.log(`[api] Variant section ${i + 1} result: ${sectionHtml.length} chars`);
        if (sectionHtml.length > 50) {
          variantSections.push(sectionHtml);
        } else {
          console.warn(`[api] Variant section ${i + 1}: short response (${sectionHtml.length} chars), using original`);
          variantSections.push(section);
        }
      } catch (err) {
        console.warn(`[api] Variant section ${i + 1} failed:`, err instanceof Error ? err.message : err);
        variantSections.push(section);
      }
    }

    const titleMatch = fullHtml.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].split(" - ")[0] : "Variant";
    const brandMatch = fullHtml.match(/\.brand-primary\s*\{\s*color:\s*([^;]+)/);
    const primary = brandMatch ? brandMatch[1].trim() : "#6366f1";
    const secondaryMatch = fullHtml.match(/\.brand-secondary\s*\{\s*color:\s*([^;]+)/);
    const secondary = secondaryMatch ? secondaryMatch[1].trim() : "#333";

    const variantHtml = assembleSections(variantSections, {
      title: `${title} — Variant`,
      brandName: title,
      primaryColor: primary,
      secondaryColor: secondary,
      analytics,
    });

    const variantId = `scr_var_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    json(res, [{ screenId: variantId, html: variantHtml }], 201);
  });

  route("GET", "/api/projects/:pid/screens/:sid/export/react", async (_r, res, params) => {
    const scr = await sdk.project(params.pid).getScreen(params.sid);
    if (!scr) { json(res, { error: "Not found" }, 404); return; }
    json(res, { code: await scr.exportReact() });
  });

  route("GET", "/api/projects/:pid/screens/:sid", async (_r, res, params) => {
    if (storage) {
      const stored = await storage.getScreen(params.pid, params.sid);
      if (stored) { json(res, { screenId: stored.id, html: stored.html, prompt: stored.prompt, deviceType: stored.deviceType }); return; }
    }
    const scr = await sdk.project(params.pid).getScreen(params.sid);
    if (!scr) { json(res, { error: "Not found" }, 404); return; }
    json(res, { screenId: scr.id, html: await scr.getHtml(), prompt: scr.prompt, deviceType: scr.deviceType });
  });

  route("GET", "/api/projects/:pid/screens", async (req, res, params) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)), 100);
    let allScreenData: Array<{ id: string; prompt: string; deviceType: string }>;
    let total: number;
    if (storage) {
      const stored = await storage.listScreens(params.pid);
      allScreenData = stored.map(s => ({ id: s.id, prompt: s.prompt, deviceType: s.deviceType }));
      total = stored.length;
    } else {
      const sdkScreens = await sdk.project(params.pid).screens();
      allScreenData = sdkScreens.map(s => ({ id: s.id, prompt: s.prompt, deviceType: s.deviceType }));
      total = sdkScreens.length;
    }
    const start = page * limit;
    const paginated = allScreenData.slice(start, start + limit);
    json(res, { screens: paginated, total, page, limit, hasMore: start + limit < total });
  });
}

/**
 * Extract a top-level section's outer HTML from a full page HTML string.
 */
function extractSectionHtml(fullHtml: string, selector: string): string | null {
  const parts = selector.split(" > ");
  const lastPart = parts[parts.length - 1];
  const dotParts = lastPart.split(".");
  const tagWithNth = dotParts[0];
  const tag = tagWithNth.replace(/:nth-of-type\(\d+\)/, "") || "section";
  const nthMatch = lastPart.match(/:nth-of-type\((\d+)\)/);
  const nthTarget = nthMatch ? parseInt(nthMatch[1], 10) : null;

  // Strategy 1: Use nth-of-type only (most reliable — ignores classes entirely)
  if (nthTarget) {
    const result = extractByTagNth(fullHtml, tag, nthTarget);
    if (result) return result;
  }

  // Strategy 2: Use classes (filter out Tailwind arbitrary values)
  const classes = dotParts.slice(1)
    .map(c => c.replace(/:nth-of-type\(\d+\)/, "").replace(/\\/g, ""))
    .filter(c => !c.includes("[") && !c.includes("#") && c.length > 0);
  if (classes.length > 0) {
    const result = extractByTagNth(fullHtml, tag, nthTarget, classes);
    if (result) return result;
  }

  return null;
}

function extractByTagNth(fullHtml: string, tag: string, nthTarget: number | null, classes?: string[]): string | null {
  try {
    const openTagRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
    let match: RegExpExecArray | null;
    let nthCount = 0;

    while ((match = openTagRe.exec(fullHtml)) !== null) {
      if (classes && classes.length > 0) {
        const classAttr = match[0].match(/class="([^"]*)"/);
        if (!classAttr) continue;
        const tagClasses = classAttr[1].split(/\s+/);
        if (!classes.every(c => tagClasses.includes(c))) continue;
      }

      nthCount++;
      if (nthTarget && nthCount !== nthTarget) continue;

      // Found the target — extract from open tag to matching close tag
      const startIdx = match.index;
      let depth = 1;
      let pos = startIdx + match[0].length;
      const innerOpenRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
      const closeRe = new RegExp(`</${tag}\\s*>`, "gi");

      while (depth > 0 && pos < fullHtml.length) {
        innerOpenRe.lastIndex = pos;
        closeRe.lastIndex = pos;
        const nextOpen = innerOpenRe.exec(fullHtml);
        const nextClose = closeRe.exec(fullHtml);
        if (!nextClose) break;
        if (nextOpen && nextOpen.index < nextClose.index) {
          depth++;
          pos = nextOpen.index + nextOpen[0].length;
        } else {
          depth--;
          pos = nextClose.index + nextClose[0].length;
          if (depth === 0) return fullHtml.slice(startIdx, pos);
        }
      }
    }
  } catch (err) {
    console.warn(`[api] Section extraction failed for tag=${tag} nth=${nthTarget}:`, err);
  }
  return null;
}
