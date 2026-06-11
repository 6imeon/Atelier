/**
 * LLM-powered Section Classifier & Animation Brief Generator
 *
 * Handles the 30% of sections that heuristics can't classify with confidence,
 * and generates structured animation briefs from screenshot sequences.
 */

import { z } from "zod";
import type { ModelRouter, ChatMessage } from "./router.js";
import type { ExtractedSection, AnimationPattern } from "./section-extractor.js";
import type { RawSectionDoc } from "../storage/interface.js";

// ─── LLM Classification (DeepSeek V3) ───────────────────────────────────────

const ClassificationSchema = z.object({
  category: z.string(),
  subType: z.string().optional(),
  confidence: z.number().min(0).max(1),
  tier: z.enum(["basic", "interactive", "animated", "cinematic"]),
});

type LLMClassification = z.infer<typeof ClassificationSchema>;

/**
 * Classify a section using an LLM when heuristic confidence is low.
 * Uses DeepSeek V3 via the `section_classify` pipeline stage.
 */
export async function classifySectionLLM(
  router: ModelRouter,
  section: ExtractedSection,
): Promise<LLMClassification> {
  // Send a compact representation — not the full HTML
  const htmlSnippet = section.html.slice(0, 3000);
  const animationSummary = section.animations.length > 0
    ? `Detected animations: ${section.animations.map(a => `${a.type} (${a.trigger})`).join(", ")}`
    : "No animations detected";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are a web UI section classifier. Given an HTML section snippet, classify it into one of these categories:
navbar, hero, features, cards, testimonials, pricing, cta, footer, forms, stats, team, gallery, faq, sidebar, modal, banner, carousel, contact, logos, content

Also determine:
- subType: a specific variant (e.g., "split-hero", "pricing-toggle", "testimonial-carousel")
- confidence: 0-1 how confident you are in this classification
- tier: basic (static HTML), interactive (JS state like tabs/accordions), animated (GSAP/CSS animations), cinematic (pinned scroll/3D/complex effects)

Respond with JSON only: { "category": "...", "subType": "...", "confidence": 0.9, "tier": "..." }`,
    },
    {
      role: "user",
      content: `Classify this section:
- Position: section ${section.index + 1} on the page
- Tag: <${section.tag}>
- Heuristic guess: ${section.classification.category} (confidence: ${section.classification.confidence})
- Text preview: ${section.textContent.slice(0, 500)}
- ${animationSummary}
- Features: ${JSON.stringify(section.classification.features)}

HTML snippet:
${htmlSnippet}`,
    },
  ];

  try {
    const result = await router.routeJSON("section_classify", messages, ClassificationSchema);
    return result;
  } catch (err) {
    // On failure, return the heuristic classification
    console.warn(`[section-classifier] LLM classification failed: ${err instanceof Error ? err.message : err}`);
    return {
      category: section.classification.category,
      subType: section.classification.subType,
      confidence: section.classification.confidence,
      tier: section.tier,
    };
  }
}

/**
 * Batch-classify multiple sections. Only sends sections with low confidence
 * to the LLM — the rest keep their heuristic classification.
 */
export async function classifySectionsLLM(
  router: ModelRouter,
  sections: ExtractedSection[],
  confidenceThreshold = 0.5,
): Promise<Map<number, LLMClassification>> {
  const results = new Map<number, LLMClassification>();
  const needsLLM = sections.filter(s => s.classification.confidence < confidenceThreshold);

  if (needsLLM.length === 0) return results;

  console.log(`[section-classifier] ${needsLLM.length}/${sections.length} sections need LLM classification`);

  // Process in parallel batches of 5
  const batchSize = 5;
  for (let i = 0; i < needsLLM.length; i += batchSize) {
    const batch = needsLLM.slice(i, i + batchSize);
    const promises = batch.map(async (section) => {
      const result = await classifySectionLLM(router, section);
      results.set(section.index, result);
    });
    await Promise.all(promises);
  }

  return results;
}

// ─── Animation Brief Generation (Qwen3-VL-235B) ─────────────────────────────

const AnimationBriefSchema = z.object({
  sectionType: z.string(),
  animationStyle: z.string(),
  effects: z.array(z.object({
    element: z.string(),
    animation: z.string(),
    trigger: z.string(),
    timing: z.string(),
    detail: z.string(),
  })),
  libraries: z.array(z.string()),
  complexity: z.enum(["basic", "intermediate", "advanced", "cinematic"]),
});

export type AnimationBrief = z.infer<typeof AnimationBriefSchema>;

/**
 * Generate an animation brief from a screenshot sequence.
 * Sends 6 screenshots to a multimodal LLM which reverse-engineers
 * what animation effects are happening between frames.
 *
 * @param router - Model router (uses `animation_brief` stage → Qwen3-VL-235B)
 * @param screenshots - 6 PNG buffers (load-t0, load-t2s, scroll-25/50/75/100%)
 * @param labels - Human-readable label for each screenshot
 * @param sectionCategory - Heuristic or LLM-classified category
 * @param detectedPatterns - Animation patterns already detected from HTML analysis
 */
export async function generateAnimationBrief(
  router: ModelRouter,
  screenshots: Buffer[],
  labels: string[],
  sectionCategory: string,
  detectedPatterns: AnimationPattern[],
): Promise<AnimationBrief> {
  const patternHints = detectedPatterns.length > 0
    ? `\nDetected from HTML analysis: ${detectedPatterns.map(p => `${p.type} (${p.trigger}): ${p.description}`).join("; ")}`
    : "";

  const imageContent = screenshots.map((buf, i) => ([
    { type: "text", text: `Frame ${i + 1} (${labels[i]}):` },
    {
      type: "image_url",
      image_url: { url: `data:image/png;base64,${buf.toString("base64")}` },
    },
  ])).flat();

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are an animation reverse-engineer for web components. You receive 6 screenshots of a web page section captured at different times and scroll positions:
1. Page load (t=0)
2. After 2 seconds (initial animations complete)
3. Scrolled to 25%
4. Scrolled to 50%
5. Scrolled to 75%
6. Scrolled to 100%

Analyze what changed between frames and reverse-engineer the animation effects used.

Respond with JSON only:
{
  "sectionType": "hero|features|stats|...",
  "animationStyle": "cinematic-reveal|scroll-parallax|data-viz|stagger-grid|...",
  "effects": [
    {
      "element": "headline|background-image|stat-counter|card|...",
      "animation": "fade-up|scale-in|counter-increment|parallax|text-split|...",
      "trigger": "on-load|on-scroll-enter|on-scroll-scrub|on-hover",
      "timing": "0.8s power4.out|scrub: true|stagger: 0.1s|...",
      "detail": "Text splits into words, each fades up with 0.05s stagger from bottom"
    }
  ],
  "libraries": ["gsap", "ScrollTrigger"],
  "complexity": "basic|intermediate|advanced|cinematic"
}

Focus on:
- Elements that appear/disappear between frames (opacity changes)
- Elements that move/transform between frames (position, scale, rotation)
- Counter/number changes (value animations)
- Background changes (parallax, color shifts)
- Elements that only appear at certain scroll positions (scroll-triggered reveals)
- Pinned/sticky elements that persist across scroll positions`,
    },
    {
      role: "user",
      content: [
        { type: "text", text: `Section type: ${sectionCategory}${patternHints}\n\nAnalyze these 6 frames and describe the animation effects:` },
        ...imageContent,
      ],
    },
  ];

  try {
    const result = await router.routeJSON("animation_brief", messages, AnimationBriefSchema);
    return result;
  } catch (err) {
    console.warn(`[section-classifier] Animation brief generation failed: ${err instanceof Error ? err.message : err}`);
    // Return a minimal brief based on detected patterns
    return {
      sectionType: sectionCategory,
      animationStyle: detectedPatterns.length > 0 ? "detected-patterns" : "static",
      effects: detectedPatterns.map(p => ({
        element: "unknown",
        animation: p.type,
        trigger: p.trigger === "scroll" ? "on-scroll-enter" : `on-${p.trigger}`,
        timing: p.duration ? `${p.duration}ms` : "unknown",
        detail: p.description,
      })),
      libraries: [...new Set(detectedPatterns.map(p => p.type).filter(t =>
        ["gsap", "scrolltrigger", "swiper", "lottie", "three-js", "framer-motion", "anime-js"].includes(t)
      ))],
      complexity: detectedPatterns.some(p => p.properties.includes("pin") || p.properties.includes("scrub"))
        ? "cinematic"
        : detectedPatterns.length > 0 ? "intermediate" : "basic",
    };
  }
}

/**
 * Convert an AnimationBrief to the format stored in RawSectionDoc.
 */
export function briefToDoc(brief: AnimationBrief): NonNullable<RawSectionDoc["animationBrief"]> {
  // Zod validates all fields are present; cast to satisfy strict TS checks
  return brief as NonNullable<RawSectionDoc["animationBrief"]>;
}
