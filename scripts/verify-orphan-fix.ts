/**
 * Test the orphaned-hidden-states fallback against:
 *   1. A hand-crafted broken HTML (hidden CSS + no matching JS) — should strip
 *   2. A valid cinematic component (hidden CSS + matching JS) — should leave alone
 *   3. The broken redesign output from the e2e test — should reveal hero content
 */

import { readFileSync } from "fs";
import { fixOrphanedHiddenStates } from "../packages/sdk/src/utils/orphaned-hidden-states.js";

function test(name: string, input: string, expectStripped: boolean) {
  const r = fixOrphanedHiddenStates(input);
  const mark = (r.strippedRules > 0) === expectStripped ? "✓" : "✗";
  console.log(`${mark} ${name}`);
  console.log(`    strippedRules=${r.strippedRules} classes=[${[...new Set(r.strippedClasses)].join(", ")}]`);
}

// Case 1: orphaned hidden states (no JS references)
test(
  "orphaned: hidden CSS with no matching JS",
  `<html><head><style>
    .reveal-up { opacity: 0; transform: translateY(60px); }
    .split-word { opacity: 0; }
  </style></head><body>
  <h1 class="reveal-up">Hello</h1>
  <script src="https://cdn.gsap.com/gsap.min.js"></script>
  </body></html>`,
  true,
);

// Case 2: hidden states WITH matching JS (should not touch)
test(
  "kept: hidden CSS with matching gsap.from selector",
  `<html><head><style>
    .my-section__word { opacity: 0; transform: translateY(60px); }
  </style></head><body>
  <span class="my-section__word">Hello</span>
  <script>gsap.from(".my-section__word", { opacity: 1, y: 0 });</script>
  </body></html>`,
  false,
);

// Case 3: real broken redesign output (if exists)
try {
  const real = readFileSync("/tmp/redesign-strattoncraig.html", "utf-8");
  const r = fixOrphanedHiddenStates(real);
  console.log(`\n3. Real broken output (/tmp/redesign-strattoncraig.html):`);
  console.log(`   strippedRules: ${r.strippedRules}`);
  console.log(`   strippedClasses: ${[...new Set(r.strippedClasses)].join(", ")}`);
  console.log(`   original size: ${real.length}, fixed size: ${r.html.length}`);

  // Check the hero is no longer stuck invisible
  const heroBefore = real.match(/id="hero-subhead"[^>]*class="([^"]*)"[^>]*>/)?.[1] || "";
  const heroAfter = r.html.match(/id="hero-subhead"[^>]*class="([^"]*)"[^>]*>/)?.[1] || "";
  console.log(`   hero-subhead class before: "${heroBefore}"`);
  console.log(`   hero-subhead class after:  "${heroAfter}"`);

  // Check inline style attr cleanup
  const beforeHiddenInline = (real.match(/opacity\s*:\s*0(?![.\d])/g) || []).length;
  const afterHiddenInline = (r.html.match(/opacity\s*:\s*0(?![.\d])/g) || []).length;
  console.log(`   opacity:0 occurrences before: ${beforeHiddenInline}, after: ${afterHiddenInline}`);
} catch {
  console.log(`\n3. Real output not found at /tmp/redesign-strattoncraig.html — skipping`);
}
