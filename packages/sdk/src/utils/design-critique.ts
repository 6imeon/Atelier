/**
 * UICrit — Automated Design Critique
 *
 * Lightweight post-generation quality gate inspired by:
 * Google Research (2024) — UICrit, UIST 2024 (11,344 professional design critiques)
 *
 * Runs a fast critique pass on generated HTML, checking for common design issues
 * without requiring an additional AI call (rule-based for speed).
 * Falls back to AI critique for ambiguous cases.
 */

import { validateGsapScriptBatch, computeAnimationQualityScore } from "./gsap-validator.js";

export interface CritiqueIssue {
  severity: "critical" | "warning" | "info";
  rule: string;
  message: string;
  fix?: string;  // auto-fix regex or description
}

export interface CritiqueReport {
  issues: CritiqueIssue[];
  score: number;       // 0-10, 10 = perfect
  passed: boolean;     // score >= 6
  autoFixed: number;   // number of issues auto-fixed
  /** Animation quality 0-1 from AST validation of inline GSAP scripts. Null if no scripts were found. */
  animationQuality?: number | null;
  /** Breakdown of the animation quality calculation. */
  animationStats?: {
    totalScripts: number;
    validScripts: number;
    scrollTriggers: number;
    gsapCalls: number;
    duplicateIds: string[];
    warnings: number;
  };
}

/**
 * Run a rule-based design critique on generated HTML.
 * Returns issues found and an optional auto-fixed HTML string.
 */
export function critiqueHtml(html: string): { report: CritiqueReport; fixedHtml: string } {
  const issues: CritiqueIssue[] = [];
  let fixed = html;
  let autoFixed = 0;

  // ─── CRO Rules ───

  // 1. Missing CTA above the fold
  const heroMatch = html.match(/<section[^>]*>[\s\S]*?<\/section>/i);
  if (heroMatch) {
    const heroHtml = heroMatch[0];
    const hasCta = /<a[^>]*class="[^"]*(?:btn|button|cta|bg-\[)[^"]*"[^>]*>|<button[^>]*>/i.test(heroHtml);
    if (!hasCta) {
      issues.push({ severity: "warning", rule: "cro-cta-above-fold", message: "Hero section has no CTA button — add a primary action above the fold" });
    }
  }

  // 2. Multiple competing CTAs in hero
  if (heroMatch) {
    const ctaCount = (heroMatch[0].match(/<(?:a|button)[^>]*class="[^"]*(?:bg-\[#|bg-brand|btn|button)[^"]*"[^>]*>/gi) || []).length;
    if (ctaCount > 2) {
      issues.push({ severity: "warning", rule: "cro-single-cta", message: `Hero has ${ctaCount} CTA-like buttons — use ONE primary CTA to avoid splitting attention` });
    }
  }

  // 3. No social proof in first 2 sections
  const firstSections = html.match(/<section[^>]*>[\s\S]*?<\/section>/gi)?.slice(0, 3) || [];
  const hasSocialProof = firstSections.some(s =>
    /testimonial|review|client|partner|trust|logo|star|rating|quot/i.test(s)
  );
  if (firstSections.length >= 2 && !hasSocialProof) {
    issues.push({ severity: "info", rule: "cro-social-proof", message: "No social proof (testimonials, client logos, ratings) found in first 2 sections" });
  }

  // ─── Visual Hierarchy ───

  // 4. Missing h1
  if (!/<h1[\s>]/i.test(html)) {
    issues.push({ severity: "warning", rule: "hierarchy-h1", message: "Page has no <h1> tag — every page should have exactly one h1 for hierarchy and SEO" });
  }

  // 5. Multiple h1s
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count > 1) {
    issues.push({ severity: "info", rule: "hierarchy-single-h1", message: `Page has ${h1Count} <h1> tags — consider using only one for clear hierarchy` });
  }

  // 6. Images without alt text
  const imgsWithoutAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;
  if (imgsWithoutAlt > 0) {
    issues.push({ severity: "warning", rule: "a11y-img-alt", message: `${imgsWithoutAlt} image(s) missing alt text` });
    // Auto-fix: add alt="" to images without alt
    console.log(`[UICrit] Auto-fix: adding alt="" to ${imgsWithoutAlt} image(s)`);
    fixed = fixed.replace(/<img(?![^>]*alt=)([^>]*)>/gi, '<img alt=""$1>');
    autoFixed += imgsWithoutAlt;
  }

  // 7. Images without dimensions
  const imgsWithoutDimensions = (html.match(/<img(?![^>]*(?:width|style="[^"]*width))[^>]*>/gi) || []).length;
  if (imgsWithoutDimensions > 0) {
    issues.push({ severity: "info", rule: "perf-img-dimensions", message: `${imgsWithoutDimensions} image(s) missing width/height — causes layout shift` });
  }

  // ─── Contrast & Color ───

  // 8. White text on white background (common LLM mistake)
  if (/class="[^"]*text-white[^"]*"/.test(html) && /class="[^"]*bg-white[^"]*"/.test(html)) {
    // Check if they're in the same section
    const sections = html.match(/<section[^>]*>[\s\S]*?<\/section>/gi) || [];
    for (const s of sections) {
      if (/text-white/i.test(s) && /bg-white/i.test(s) && !/bg-\[/i.test(s)) {
        issues.push({ severity: "critical", rule: "contrast-invisible-text", message: "Section has white text on white background — text will be invisible" });
      }
    }
  }

  // 9. Very low contrast text classes
  const lowContrastPatterns = [
    { pattern: /text-gray-200/g, message: "text-gray-200 on light backgrounds has poor contrast" },
    { pattern: /text-gray-100/g, message: "text-gray-100 is nearly invisible on white" },
  ];
  for (const { pattern, message } of lowContrastPatterns) {
    if (pattern.test(html)) {
      issues.push({ severity: "warning", rule: "contrast-low", message });
    }
  }

  // ─── Layout ───

  // 10. Section without max-width constraint (content spans full 1920px)
  const allSections = html.match(/<section[^>]*>[\s\S]*?<\/section>/gi) || [];
  for (const s of allSections) {
    const hasConstraint = /max-w-|mx-auto|container/i.test(s);
    const isFullBleed = /bg-\[|bg-black|bg-white|bg-gray/i.test(s);
    if (!hasConstraint && !isFullBleed && s.length > 500) {
      issues.push({ severity: "info", rule: "layout-max-width", message: "Section content may stretch too wide — consider adding max-w-7xl mx-auto" });
      break; // Only report once
    }
  }

  // 11. Empty sections (generated placeholder or failed generation)
  for (const s of allSections) {
    const textContent = s.replace(/<[^>]*>/g, "").trim();
    if (textContent.length < 20 && s.length < 300) {
      issues.push({ severity: "warning", rule: "content-empty-section", message: "Section appears to be empty or placeholder content" });
    }
  }

  // ─── Animation Safety ───

  // 12. toggleActions with reverse (causes elements to disappear)
  if (/toggleActions:\s*['"]play none none reverse['"]/i.test(html)) {
    issues.push({ severity: "critical", rule: "anim-reverse", message: "ScrollTrigger toggleActions uses 'reverse' — elements will disappear on scroll back" });
    console.log(`[UICrit] Auto-fix: replacing toggleActions 'reverse' with once:true`);
    fixed = fixed.replace(/toggleActions:\s*['"]play none none reverse['"]/g, "once: true");
    autoFixed++;
  }

  // 13. opacity-0 on visible sections (flash of invisible content)
  const heroSection = allSections[0];
  if (heroSection && /class="[^"]*opacity-0[^"]*"/.test(heroSection)) {
    issues.push({ severity: "warning", rule: "anim-hero-invisible", message: "Hero section has opacity-0 class — content will be invisible until JS runs" });
  }

  // ─── Animation Quality (Track 4) ───
  // AST-validate all inline <script> blocks via gsap-validator.
  const scriptBlocks = Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)).map(m => m[1]);
  let animationQuality: number | null = null;
  let animationStats: CritiqueReport["animationStats"] = undefined;
  if (scriptBlocks.length > 0) {
    const batch = validateGsapScriptBatch(scriptBlocks);
    animationQuality = computeAnimationQualityScore(batch);
    animationStats = {
      totalScripts: scriptBlocks.length,
      validScripts: batch.results.filter((r: { valid: boolean }) => r.valid).length,
      scrollTriggers: batch.totalScrollTriggers,
      gsapCalls: batch.totalGsapCalls,
      duplicateIds: batch.duplicateIds,
      warnings: batch.results.reduce((a: number, r: { warnings: string[] }) => a + r.warnings.length, 0),
    };
    // Report animation-level issues into the critique stream
    for (const [i, r] of batch.results.entries()) {
      if (!r.valid) {
        issues.push({ severity: "critical", rule: "anim-invalid-syntax", message: `Script ${i + 1}: ${r.errors.join("; ")}` });
      }
    }
    if (batch.duplicateIds.length > 0) {
      issues.push({ severity: "warning", rule: "anim-duplicate-trigger-ids", message: `Duplicate ScrollTrigger IDs: ${batch.duplicateIds.join(", ")}` });
    }
  }

  // ─── Score ───

  const criticalCount = issues.filter(i => i.severity === "critical").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;
  const infoCount = issues.filter(i => i.severity === "info").length;
  const score = Math.max(0, 10 - criticalCount * 3 - warningCount * 1 - infoCount * 0.3);

  return {
    report: {
      issues,
      score: Math.round(score * 10) / 10,
      passed: score >= 6,
      autoFixed,
      animationQuality,
      animationStats,
    },
    fixedHtml: fixed,
  };
}
