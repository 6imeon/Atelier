/**
 * Aaker-Driven Design Token Generator
 *
 * Maps the 5-dimension Aaker brand personality vector to concrete design tokens:
 *   border-radius, spacing density, shadow depth, animation speed/easing,
 *   and letter-spacing.
 *
 * Each dimension pulls the token value toward its aesthetic:
 *   Sincerity      → rounded corners, generous spacing, soft shadows, gentle animations
 *   Excitement     → bold radii, dynamic spacing, vivid shadows, fast snappy animations
 *   Competence     → moderate radii, tight spacing, subtle shadows, moderate animations
 *   Sophistication → refined radii, airy spacing, deep elegant shadows, slow smooth animations
 *   Ruggedness     → sharp corners, dense spacing, no/hard shadows, minimal animations
 *
 * Reference: Aaker (1997) — Dimensions of Brand Personality
 * Architecture: primitive → semantic → component (three-tier token system)
 */
import type { AakerVector } from "./personas.js";

// ─── Types ─────────────────────────────────────────────────────────

export interface AakerDesignTokens {
  /** Border radius tokens in px */
  borderRadius: {
    none: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  /** Spacing scale in px (multiplied from base unit) */
  spacing: {
    unit: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    "2xl": number;
    "3xl": number;
    sectionPadding: number;
  };
  /** Box shadow tokens */
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  /** Animation tokens */
  animation: {
    /** Duration for micro-interactions (hover, focus) in seconds */
    durationFast: number;
    /** Duration for element entrances in seconds */
    durationNormal: number;
    /** Duration for page-level transitions in seconds */
    durationSlow: number;
    /** CSS easing function */
    easing: string;
    /** GSAP ease string */
    gsapEase: string;
    /** Whether to use stagger animations */
    stagger: boolean;
    /** Stagger delay between items in seconds */
    staggerDelay: number;
  };
  /** Letter spacing tokens in em */
  letterSpacing: {
    tight: number;
    normal: number;
    wide: number;
    wider: number;
  };
  /** Visual density label */
  density: "compact" | "comfortable" | "spacious";
}

// ─── Dimension Weights ─────────────────────────────────────────────

// Border radius base values per dimension (in px)
// Sincerity=round, Excitement=bold, Competence=moderate, Sophistication=refined, Ruggedness=sharp
const RADIUS_WEIGHTS: [number, number, number, number, number] = [12, 16, 6, 4, 0];

// Spacing base unit per dimension (in px)
// Sincerity=generous, Excitement=dynamic, Competence=tight, Sophistication=airy, Ruggedness=dense
const SPACING_WEIGHTS: [number, number, number, number, number] = [6, 5, 4, 7, 3];

// Shadow depth per dimension (0-1 scale, used to interpolate opacity and blur)
// Sincerity=soft, Excitement=vivid, Competence=subtle, Sophistication=deep, Ruggedness=none
const SHADOW_WEIGHTS: [number, number, number, number, number] = [0.4, 0.6, 0.3, 0.8, 0.0];

// Animation speed multiplier (lower = faster, higher = slower)
const ANIM_SPEED: [number, number, number, number, number] = [0.8, 0.5, 0.7, 1.2, 0.0];

// Letter spacing offsets in em
const TRACKING_WEIGHTS: [number, number, number, number, number] = [0.0, -0.01, 0.01, 0.03, -0.02];

// ─── Core ──────────────────────────────────────────────────────────

/**
 * Generate concrete design tokens from an Aaker personality vector.
 *
 * @param aakerVector 5D vector [Sincerity, Excitement, Competence, Sophistication, Ruggedness]
 * @returns AakerDesignTokens with concrete px/em/string values ready for prompt injection
 */
export function computeDesignTokens(aakerVector: AakerVector): AakerDesignTokens {
  const totalWeight = aakerVector.reduce((s, v) => s + v, 0) || 1;

  // ── Border Radius ──
  let radiusBase = 0;
  for (let i = 0; i < 5; i++) radiusBase += RADIUS_WEIGHTS[i] * aakerVector[i];
  radiusBase = Math.round(radiusBase / totalWeight);

  const borderRadius = {
    none: 0,
    sm: Math.max(0, Math.round(radiusBase * 0.5)),
    md: Math.max(0, radiusBase),
    lg: Math.max(0, Math.round(radiusBase * 1.5)),
    xl: Math.max(0, Math.round(radiusBase * 2.5)),
    full: 9999,
  };

  // ── Spacing ──
  let spacingUnit = 0;
  for (let i = 0; i < 5; i++) spacingUnit += SPACING_WEIGHTS[i] * aakerVector[i];
  spacingUnit = Math.round(spacingUnit / totalWeight);
  // Clamp to reasonable range
  spacingUnit = Math.max(3, Math.min(8, spacingUnit));

  const spacing = {
    unit: spacingUnit,
    xs: spacingUnit,
    sm: spacingUnit * 2,
    md: spacingUnit * 3,
    lg: spacingUnit * 4,
    xl: spacingUnit * 6,
    "2xl": spacingUnit * 8,
    "3xl": spacingUnit * 12,
    sectionPadding: spacingUnit * 16,
  };

  // Determine visual density from spacing unit
  const density: AakerDesignTokens["density"] =
    spacingUnit <= 4 ? "compact" : spacingUnit >= 6 ? "spacious" : "comfortable";

  // ── Shadows ──
  let shadowDepth = 0;
  for (let i = 0; i < 5; i++) shadowDepth += SHADOW_WEIGHTS[i] * aakerVector[i];
  shadowDepth = shadowDepth / totalWeight;

  // Determine shadow style from dominant dimension
  const isSophisticated = aakerVector[3] >= 0.6;
  const isExciting = aakerVector[1] >= 0.7;
  const isRugged = aakerVector[4] >= 0.6;

  const shadows = isRugged
    ? {
        sm: "none",
        md: "none",
        lg: "0 1px 2px rgba(0,0,0,0.15)",
        xl: "0 2px 4px rgba(0,0,0,0.2)",
      }
    : isSophisticated
      ? {
          sm: `0 1px 3px rgba(0,0,0,${(shadowDepth * 0.06).toFixed(2)})`,
          md: `0 4px 12px rgba(0,0,0,${(shadowDepth * 0.08).toFixed(2)})`,
          lg: `0 8px 30px rgba(0,0,0,${(shadowDepth * 0.1).toFixed(2)})`,
          xl: `0 16px 50px rgba(0,0,0,${(shadowDepth * 0.12).toFixed(2)})`,
        }
      : isExciting
        ? {
            sm: `0 2px 4px rgba(0,0,0,${(shadowDepth * 0.1).toFixed(2)})`,
            md: `0 4px 8px rgba(0,0,0,${(shadowDepth * 0.14).toFixed(2)})`,
            lg: `0 8px 16px rgba(0,0,0,${(shadowDepth * 0.18).toFixed(2)})`,
            xl: `0 12px 24px rgba(0,0,0,${(shadowDepth * 0.22).toFixed(2)})`,
          }
        : {
            sm: `0 1px 2px rgba(0,0,0,${(shadowDepth * 0.08).toFixed(2)})`,
            md: `0 2px 6px rgba(0,0,0,${(shadowDepth * 0.1).toFixed(2)})`,
            lg: `0 4px 12px rgba(0,0,0,${(shadowDepth * 0.12).toFixed(2)})`,
            xl: `0 8px 24px rgba(0,0,0,${(shadowDepth * 0.15).toFixed(2)})`,
          };

  // ── Animation ──
  let animSpeed = 0;
  for (let i = 0; i < 5; i++) animSpeed += ANIM_SPEED[i] * aakerVector[i];
  animSpeed = animSpeed / totalWeight;
  // If ruggedness is dominant, minimal animation
  const animEnabled = aakerVector[4] < 0.7;

  // Easing: sophistication → smooth cubic, excitement → snappy back, sincerity → gentle ease
  let easing: string;
  let gsapEase: string;
  if (aakerVector[3] >= 0.6) {
    easing = "cubic-bezier(0.22, 1, 0.36, 1)";
    gsapEase = "power2.out";
  } else if (aakerVector[1] >= 0.7) {
    easing = "cubic-bezier(0.34, 1.56, 0.64, 1)";
    gsapEase = "back.out(1.7)";
  } else if (aakerVector[4] >= 0.6) {
    easing = "ease";
    gsapEase = "none";
  } else {
    easing = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    gsapEase = "power1.out";
  }

  const animation = {
    durationFast: animEnabled ? Math.round(animSpeed * 200) / 1000 : 0,
    durationNormal: animEnabled ? Math.round(animSpeed * 500) / 1000 : 0,
    durationSlow: animEnabled ? Math.round(animSpeed * 900) / 1000 : 0,
    easing,
    gsapEase,
    stagger: animEnabled && (aakerVector[1] >= 0.4 || aakerVector[3] >= 0.5),
    staggerDelay: animEnabled ? Math.round(animSpeed * 80) / 1000 : 0,
  };

  // ── Letter Spacing ──
  let trackingOffset = 0;
  for (let i = 0; i < 5; i++) trackingOffset += TRACKING_WEIGHTS[i] * aakerVector[i];
  trackingOffset = trackingOffset / totalWeight;

  const letterSpacing = {
    tight: Math.round((trackingOffset - 0.02) * 1000) / 1000,
    normal: Math.round(trackingOffset * 1000) / 1000,
    wide: Math.round((trackingOffset + 0.05) * 1000) / 1000,
    wider: Math.round((trackingOffset + 0.12) * 1000) / 1000,
  };

  return { borderRadius, spacing, shadows, animation, letterSpacing, density };
}

// ─── Prompt Formatting ─────────────────────────────────────────────

/**
 * Format design tokens into a plain-text block for AI prompt injection.
 */
export function formatDesignTokensForPrompt(tokens: AakerDesignTokens): string {
  const r = tokens.borderRadius;
  const s = tokens.spacing;
  const a = tokens.animation;
  const ls = tokens.letterSpacing;

  const lines = [
    `DESIGN TOKENS (use these for visual consistency):`,
    `- Border radius: sm=${r.sm}px  md=${r.md}px  lg=${r.lg}px  xl=${r.xl}px (use rounded-[${r.md}px] for cards/buttons, rounded-[${r.lg}px] for modals/images)`,
    `- Spacing unit: ${s.unit}px — xs=${s.xs}px  sm=${s.sm}px  md=${s.md}px  lg=${s.lg}px  xl=${s.xl}px  2xl=${s["2xl"]}px  3xl=${s["3xl"]}px`,
    `- Section padding: py-[${s.sectionPadding}px] (${tokens.density} density)`,
    `- Shadows: sm="${tokens.shadows.sm}"  md="${tokens.shadows.md}"  lg="${tokens.shadows.lg}"`,
    `- Animation: duration=${a.durationNormal}s  ease="${a.gsapEase}"${a.stagger ? `  stagger=${a.staggerDelay}s` : ""}`,
    `- Letter spacing: headings=${ls.wide}em  body=${ls.normal}em  labels/overlines=${ls.wider}em`,
  ];

  return lines.join("\n");
}
