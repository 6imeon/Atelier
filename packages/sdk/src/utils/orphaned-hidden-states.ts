/**
 * Fallback safety net: when Kimi produces CSS that hides elements (opacity: 0,
 * translateY, etc.) but fails to write the JS that reveals them, the page
 * renders blank for the user.
 *
 * This utility scans the final assembled HTML for CSS rules that set hidden
 * initial states, checks whether the target class is referenced by any
 * remaining GSAP script, and if not, neutralizes the hidden state so content
 * is visible by default.
 *
 * This runs AFTER Track 4's gsap-validator has stripped broken scripts, so
 * the script set it checks against is the final, validated set.
 */

interface OrphanedHiddenStatesResult {
  html: string;
  strippedRules: number;
  strippedClasses: string[];
}

/**
 * Extract class names from CSS selectors in a <style> block that set one of
 * the hidden-initial-state patterns we care about.
 */
function findHiddenStateClasses(styleContent: string): Map<string, string[]> {
  const result = new Map<string, string[]>();

  // Very lightweight CSS rule parser — finds `.classname { ... }` blocks
  const ruleRegex = /(\.[A-Za-z_][\w-]*)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ruleRegex.exec(styleContent)) !== null) {
    const className = match[1].slice(1); // drop leading "."
    const body = match[2];

    // Hidden-state signals — any of these means the element is invisible by default
    const hiddenSignals: string[] = [];
    if (/opacity\s*:\s*0(?![.\d])/i.test(body)) hiddenSignals.push("opacity:0");
    if (/transform\s*:\s*translate[YyX]?\s*\(\s*-?\d*\.?\d+\s*(px|%|em|rem|vh|vw)\s*\)/i.test(body)) hiddenSignals.push("transform:translate");
    if (/transform\s*:\s*scale\s*\(\s*0(?:\.\d+)?\s*\)/i.test(body)) hiddenSignals.push("transform:scale(0)");
    // Any clip-path inset with 100% or 50% collapses the box to zero visible area.
    // Note: no \b around 100%/50% because % is not a word character and we want
    // to match "inset(0 100% 0 0)" and "inset(50% 50%)" etc.
    if (/clip-path\s*:\s*inset\s*\([^)]*(?:100%|50%)[^)]*\)/i.test(body)) hiddenSignals.push("clip-path:inset-hidden");
    if (/visibility\s*:\s*hidden/i.test(body)) hiddenSignals.push("visibility:hidden");

    if (hiddenSignals.length > 0) {
      result.set(className, hiddenSignals);
    }
  }

  return result;
}

/**
 * Check if a class name appears as a GSAP animation target in any script.
 * Scans for patterns like `".classname"`, `'.classname'`, `.classname__element`, etc.
 */
function classReferencedByScripts(className: string, scriptsContent: string): boolean {
  // Direct selector match: ".my-class" or '.my-class'
  const selectorRegex = new RegExp(`['"\`]\\.${escapeRegex(className)}(?:['"\`\\s,>~+])`, "i");
  if (selectorRegex.test(scriptsContent)) return true;

  // As a descendant or compound selector: ".my-class__child", ".parent .my-class"
  const compoundRegex = new RegExp(`['"\`][^'"\`]*\\.${escapeRegex(className)}[^'"\`]*['"\`]`, "i");
  if (compoundRegex.test(scriptsContent)) return true;

  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strip hidden-state declarations from a CSS rule body for the given class.
 * Returns the rewritten CSS body (with hidden properties removed).
 */
function neutralizeHiddenState(body: string): string {
  return body
    // opacity: 0 → remove
    .replace(/opacity\s*:\s*0(?![.\d])\s*;?/gi, "")
    // transform: translateY(60px) → remove (only hidden-state translates)
    .replace(/transform\s*:\s*translate[YyX]?\s*\(\s*-?\d*\.?\d+\s*(?:px|%|em|rem|vh|vw)\s*\)\s*;?/gi, "")
    // transform: scale(0) or scale(0.x) → remove
    .replace(/transform\s*:\s*scale\s*\(\s*0(?:\.\d+)?\s*\)\s*;?/gi, "")
    // clip-path: inset(50% ...) → remove
    .replace(/clip-path\s*:\s*inset\s*\([^)]*\)\s*;?/gi, "")
    // visibility: hidden → remove
    .replace(/visibility\s*:\s*hidden\s*;?/gi, "");
}

/**
 * Tailwind utility classes that hide elements by default. When the page has
 * no inline reveal script at all, these are almost certainly orphaned and
 * will leave the page blank. Stripped only in that nuclear case — we never
 * remove them when a reveal script exists (it may be the reveal target).
 */
// Kimi uses translate-y-5/8/10/12/16/20/24/32/40/48/full as hidden initial
// offsets when setting up reveal animations. translate-y-1/2/3/4 and smaller
// fractions (1/2, 1/3) are typically layout/centering, not hidden states —
// leave those alone. translate-y-6 is borderline but also usually layout.
const HIDDEN_UTILITY_RE = /\b(?:opacity-0|invisible|clip-reveal|scale-0|scale-50|(?:-)?translate-[xy]-(?:5|8|10|12|16|20|24|32|40|48|full|\[[^\]]+\]))\b/g;

/**
 * Check whether the inline scripts contain any code that could reveal hidden
 * elements: GSAP tweens, class mutations, or style mutations. If none found,
 * every Tailwind hidden utility on elements is presumed orphaned.
 */
function hasRevealLogic(scriptContent: string): boolean {
  if (!scriptContent || scriptContent.trim().length === 0) return false;
  // GSAP or direct DOM mutation patterns that reveal hidden states
  return /gsap\.(?:from|to|fromTo|timeline|set)\s*\(|ScrollTrigger\.(?:create|refresh)|classList\.(?:add|remove|toggle|replace)|setAttribute\s*\(\s*['"]class['"]|\.className\s*=|\.style\.(?:opacity|transform|visibility)\s*=/i.test(scriptContent);
}

/**
 * Count elements that carry a hidden utility class. Used to decide whether
 * the reveal-script injection is worth doing.
 */
function countHiddenUtilityElements(html: string): number {
  let count = 0;
  const re = /\sclass="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (HIDDEN_UTILITY_RE.test(m[1])) count++;
    HIDDEN_UTILITY_RE.lastIndex = 0; // reset /g state between tests
  }
  return count;
}

/**
 * Build the scroll-reveal script that preserves Kimi's intent: elements stay
 * hidden until they scroll into view, then fade/slide in via class removal.
 * Works for Tailwind utilities AND custom classes like `.clip-reveal`.
 *
 * Design:
 *   - IntersectionObserver with low threshold (0.08) + negative root margin so
 *     reveal fires when the top ~10% of the element is on screen.
 *   - Applies a transition inline BEFORE removing the class, so the class
 *     removal is animated rather than instant.
 *   - Staggers sibling elements by ~0.05s each for a nice cascade effect.
 *   - Unobserves after reveal so each element animates once.
 *   - Self-contained: no external deps, no framework assumptions.
 */
function buildScrollRevealScript(): string {
  return `<script>
(function(){
  var classes = ["opacity-0","invisible","clip-reveal","scale-0","scale-50","translate-y-5","translate-y-8","translate-y-10","translate-y-12","translate-y-16","translate-y-20","translate-y-24","translate-y-32","translate-y-40","translate-y-48","translate-y-full","-translate-y-5","-translate-y-8","-translate-y-10","-translate-y-12","-translate-y-16","-translate-y-20","-translate-y-24","-translate-y-32","-translate-y-40","-translate-y-48","-translate-y-full","translate-x-5","translate-x-8","translate-x-10","translate-x-12","translate-x-16","translate-x-20","translate-x-24","translate-x-32","translate-x-40","translate-x-48","translate-x-full","-translate-x-5","-translate-x-8","-translate-x-10","-translate-x-12","-translate-x-16","-translate-x-20","-translate-x-24","-translate-x-32","-translate-x-40","-translate-x-48","-translate-x-full"];
  function isHidden(el){ for (var i=0;i<classes.length;i++){ if (el.classList.contains(classes[i])) return true; } return false; }
  var all = document.querySelectorAll("*");
  var targets = [];
  for (var i=0;i<all.length;i++){ if (isHidden(all[i])) targets.push(all[i]); }
  if (targets.length === 0) return;
  targets.forEach(function(el){
    el.style.willChange = "opacity, transform, clip-path";
    el.style.transition = "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), clip-path 1s cubic-bezier(0.16, 1, 0.3, 1)";
  });
  if (!("IntersectionObserver" in window)) {
    targets.forEach(function(el){ classes.forEach(function(c){ el.classList.remove(c); }); });
    return;
  }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry, idx){
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var delay = (idx % 8) * 60;
      setTimeout(function(){
        classes.forEach(function(c){ el.classList.remove(c); });
      }, delay);
      io.unobserve(el);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
  targets.forEach(function(el){ io.observe(el); });
})();
</script>`;
}

/**
 * Inject the scroll-reveal script before </body>. Returns the count of target
 * elements for logging.
 */
function injectScrollRevealScript(html: string): { html: string; targets: number } {
  const targets = countHiddenUtilityElements(html);
  if (targets === 0) return { html, targets: 0 };
  const script = buildScrollRevealScript();
  // Insert before the closing </body> tag. If no </body>, append to end.
  if (/<\/body>/i.test(html)) {
    return { html: html.replace(/<\/body>/i, script + "\n</body>"), targets };
  }
  return { html: html + "\n" + script, targets };
}

/**
 * Main entry: scans HTML for orphaned hidden-state CSS rules and neutralizes
 * them. An "orphan" is a class with hidden-state CSS whose class name is NOT
 * referenced in any script's GSAP target selectors.
 */
export function fixOrphanedHiddenStates(html: string): OrphanedHiddenStatesResult {
  // Extract all <style> blocks + <script> blocks
  const styleMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  const scriptMatches = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  const allScriptContent = scriptMatches.map(m => m[1]).join("\n");
  const pageHasRevealLogic = hasRevealLogic(allScriptContent);

  let fixedHtml = html;
  let strippedRules = 0;
  const strippedClasses: string[] = [];

  // CSS-rule orphan pass runs ONLY when the page has some reveal logic
  // already. If there's no reveal script at all, we'll inject one below
  // instead — and the observer needs the original CSS rules intact so it can
  // reveal elements by removing their hidden classes.
  if (pageHasRevealLogic) {
    for (const styleMatch of styleMatches) {
      const original = styleMatch[0];
      const content = styleMatch[1];
      const hiddenClasses = findHiddenStateClasses(content);
      if (hiddenClasses.size === 0) continue;

      let rewrittenContent = content;
      for (const [className] of hiddenClasses) {
        if (classReferencedByScripts(className, allScriptContent)) continue;

        // Orphan detected — neutralize hidden state for this class
        const ruleRegex = new RegExp(`(\\.${escapeRegex(className)}\\s*\\{)([^}]*)(\\})`, "g");
        rewrittenContent = rewrittenContent.replace(ruleRegex, (_, open, body, close) => {
          strippedRules++;
          strippedClasses.push(className);
          return open + neutralizeHiddenState(body) + close;
        });
      }

      if (rewrittenContent !== content) {
        const rewritten = original.replace(content, rewrittenContent);
        fixedHtml = fixedHtml.replace(original, rewritten);
      }
    }
  }

  // Also handle inline style attributes with hidden states — strip the whole
  // style attr only if it contains ONLY hidden-state properties (otherwise
  // preserve other styles).
  fixedHtml = fixedHtml.replace(
    /\sstyle="([^"]*)"/gi,
    (match, styleBody) => {
      const hadHidden = /opacity\s*:\s*0(?![.\d])|transform\s*:\s*translate|visibility\s*:\s*hidden/i.test(styleBody);
      if (!hadHidden) return match;
      const cleaned = neutralizeHiddenState(styleBody).trim();
      if (cleaned.length === 0) {
        strippedRules++;
        return "";
      }
      if (cleaned !== styleBody.trim()) {
        strippedRules++;
        return ` style="${cleaned}"`;
      }
      return match;
    },
  );

  // Reveal-script injection: when the page has NO reveal logic at all (Kimi
  // forgot the <script> block entirely), synthesize a compact
  // IntersectionObserver script that removes hidden utility classes as
  // elements scroll into view. Preserves designer intent (content animates
  // in) instead of nuking it (content pre-visible).
  if (!pageHasRevealLogic) {
    const { html: rescued, targets } = injectScrollRevealScript(fixedHtml);
    if (targets > 0) {
      fixedHtml = rescued;
      strippedRules += targets;
      strippedClasses.push(`[reveal-script-injected: ${targets} elements]`);
    }
  }

  return { html: fixedHtml, strippedRules, strippedClasses };
}
