/**
 * Multi-page consistency: extract structural patterns from generated HTML
 * to enforce visual consistency across subsequent pages.
 */

/** Extracted structural patterns from a previously generated page for cross-page consistency */
export interface ConsistencyConstraints {
  /** Raw HTML of the generated nav section */
  navHtml?: string;
  /** Raw HTML of the generated footer section */
  footerHtml?: string;
  /** Button style classes extracted from the first page (e.g. "bg-[#cf0011] text-white rounded-[8px] px-8 py-4") */
  buttonClasses?: string;
  /** Section padding pattern (e.g. "py-20 px-8 md:px-16") */
  sectionPadding?: string;
}

/**
 * Extract structural patterns from a generated page's HTML to enforce
 * consistency across subsequent pages in a multi-page redesign.
 *
 * Extracts: nav section, footer section, primary button classes, section padding.
 */
export function extractConsistencyConstraints(html: string): ConsistencyConstraints {
  const constraints: ConsistencyConstraints = {};

  // Extract nav: first <nav> or <header> block
  const navMatch = html.match(/<(?:nav|header)\b[^>]*>[\s\S]*?<\/(?:nav|header)>/i);
  if (navMatch) {
    constraints.navHtml = navMatch[0];
    console.log(`[consistency] Extracted nav: ${constraints.navHtml.length} chars`);
  }

  // Extract footer: last <footer> block
  const footerMatches = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi);
  if (footerMatches && footerMatches.length > 0) {
    constraints.footerHtml = footerMatches[footerMatches.length - 1];
    console.log(`[consistency] Extracted footer: ${constraints.footerHtml.length} chars`);
  }

  // Extract primary button pattern: look for CTA-like buttons/links with brand color classes
  const btnMatch = html.match(/<(?:a|button)\b[^>]*class="([^"]*bg-\[[^\]]+\][^"]*)"[^>]*>/i);
  if (btnMatch) {
    // Extract just the Tailwind classes that define the button's visual appearance
    const classes = btnMatch[1];
    const visualClasses = classes.split(/\s+/).filter(c =>
      /^(bg-|text-|rounded|px-|py-|font-|shadow|hover:|transition|border)/.test(c)
    ).join(" ");
    if (visualClasses.length > 10) {
      constraints.buttonClasses = visualClasses;
      console.log(`[consistency] Extracted button pattern: ${constraints.buttonClasses}`);
    }
  }

  // Extract section padding pattern: most common py-* px-* pattern
  const paddingMatches = html.match(/class="[^"]*\b(py-\d+\s+px-\d+(?:\s+md:px-\d+)?)/g);
  if (paddingMatches && paddingMatches.length > 0) {
    // Find the most common padding pattern
    const paddingCounts = new Map<string, number>();
    for (const m of paddingMatches) {
      const p = m.match(/\b(py-\d+\s+px-\d+(?:\s+md:px-\d+)?)/)?.[1] || "";
      if (p) paddingCounts.set(p, (paddingCounts.get(p) || 0) + 1);
    }
    let best = "";
    let bestCount = 0;
    for (const [p, count] of paddingCounts) {
      if (count > bestCount) { best = p; bestCount = count; }
    }
    if (best) {
      constraints.sectionPadding = best;
      console.log(`[consistency] Extracted section padding: ${best} (${bestCount} occurrences)`);
    }
  }

  return constraints;
}

// ─── Why Overlay Helpers ───────────────────────────────────────────

/**
 * Post-generation: parse full-page HTML into top-level sections and inject
 * data-why-* attributes for the "Why" overlay. Works on monolithic HTML
 * from redesignFromURL() / generatePage() where sections aren't generated
 * individually.
 */
export function injectWhyAttributes(html: string, personaId: string): string {
  console.log(`[why-inject] Called with ${html.length} chars, personaId=${personaId}`);
  console.log(`[why-inject] HTML starts with: ${html.slice(0, 100)}`);
  console.log(`[why-inject] Contains <section: ${(html.match(/<section/gi) || []).length}, <nav: ${(html.match(/<nav/gi) || []).length}, <header: ${(html.match(/<header/gi) || []).length}, <footer: ${(html.match(/<footer/gi) || []).length}`);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  // Match top-level <section>, <nav>, <header>, <footer> tags
  let count = 0;
  const result = html.replace(
    /(<(?:section|nav|header|footer)\b)([^>]*>)/gi,
    (full, tag, rest) => {
      count++;
      // Detect section type from tag + classes + text content
      const tagName = tag.replace("<", "").toLowerCase();
      let type = tagName;
      if (tagName === "section") {
        // Try to detect from class names
        const classMatch = rest.match(/class="([^"]*)"/i);
        const classes = classMatch ? classMatch[1].toLowerCase() : "";
        if (/hero|banner/.test(classes)) type = "hero";
        else if (/pricing|plan/.test(classes)) type = "pricing";
        else if (/testimonial|review/.test(classes)) type = "testimonials";
        else if (/feature|benefit/.test(classes)) type = "features";
        else if (/stat|metric|counter/.test(classes)) type = "stats";
        else if (/team|people/.test(classes)) type = "team";
        else if (/faq|question/.test(classes)) type = "faq";
        else if (/cta|call-to-action/.test(classes)) type = "cta";
        else if (/contact|form/.test(classes)) type = "contact";
        else if (/gallery|portfolio/.test(classes)) type = "gallery";
        else if (/partner|client|logo|trust/.test(classes)) type = "logos";
        else type = "content";
      }

      const croRules: string[] = [];
      if (type === "nav") croRules.push("sticky-nav-cta");
      if (type === "hero") croRules.push("single-cta-above-fold", "hero-max-100vh", "high-contrast-cta");
      if (type === "testimonials" || type === "logos") croRules.push("social-proof-2-viewports");
      if (type === "contact") croRules.push("form-fields-max-4");

      const attrs = ` data-why-type="${esc(type)}" data-why-label="Section ${count}" data-why-persona="${esc(personaId)}" data-why-rationale="Generated as part of full-page redesign." data-why-source="generated"${croRules.length > 0 ? ` data-why-cro="${croRules.join(",")}"` : ""}`;
      return tag + attrs + rest;
    }
  );

  console.log(`[sdk] Injected data-why-* attributes into ${count} sections (full-page path)`);
  return result;
}
