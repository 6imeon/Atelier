import { critiqueHtml } from "../packages/sdk/src/utils/design-critique.js";
import { readFileSync } from "fs";

const comps = JSON.parse(readFileSync("scripts/components-cinematic.json", "utf-8"));
for (const c of comps.slice(0, 3)) {
  const { report } = critiqueHtml(c.html);
  console.log(c.id);
  console.log("  score:", report.score);
  console.log("  animationQuality:", report.animationQuality);
  console.log("  stats:", JSON.stringify(report.animationStats));
  console.log();
}
