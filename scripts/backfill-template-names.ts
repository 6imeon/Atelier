/**
 * Backfill name/description/source metadata onto previously approved
 * section_templates by joining each row to its source generated_components
 * doc via sourceGenerationId.
 *
 * Why this exists: the approve endpoint used to drop name/description on
 * the floor when promoting an engine-generated component into the library,
 * leaving every approved component showing as "hero (multi)" in the UI.
 * The endpoint is fixed going forward; this script repairs the existing rows.
 *
 * Usage:
 *   npx tsx scripts/backfill-template-names.ts            # show what would change
 *   npx tsx scripts/backfill-template-names.ts --apply    # actually write
 */

import { resolve } from "path";
import { readFileSync, existsSync } from "fs";

const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error("MONGO_URI not set in .env"); process.exit(1); }

  const apply = process.argv.includes("--apply");

  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("atelier");
  const templates = db.collection("section_templates");
  const generated = db.collection("generated_components");

  const allTemplates = await templates.find({}).toArray();
  console.log(`Found ${allTemplates.length} section_templates total\n`);

  const toUpdate: Array<{ id: any; sourceGenerationId: any; before: { name?: string; description?: string }; after: any }> = [];
  let alreadyGood = 0;
  let noSourceLink = 0;
  let sourceMissing = 0;

  for (const tpl of allTemplates) {
    if (tpl.name && tpl.description) { alreadyGood++; continue; }
    if (!tpl.sourceGenerationId) { noSourceLink++; continue; }

    const src = await generated.findOne({ id: tpl.sourceGenerationId });
    if (!src) { sourceMissing++; continue; }

    // Mirror the same projection logic the fixed approve endpoint now uses.
    const personaTag = typeof src.source === "string"
      ? src.source.split(":")[1]
      : src.source?.persona;
    const industryTag = typeof src.source === "string"
      ? src.source.split(":")[2]
      : src.source?.industry;

    const update: any = {};
    if (!tpl.name && src.name) update.name = src.name;
    if (!tpl.description && src.description) update.description = src.description;
    if (!tpl.source && src.source) update.source = src.source;
    if (!tpl.style && personaTag) update.style = personaTag;
    if ((!tpl.industry || tpl.industry === "multi") && industryTag) update.industry = industryTag;
    if (!tpl.brandName && (src.brandName || src.source?.brandName)) update.brandName = src.brandName || src.source?.brandName;
    if (!tpl.sourceUrl && (src.sourceUrl || src.source?.url)) update.sourceUrl = src.sourceUrl || src.source?.url;
    if (!tpl.sourceDomain && (src.sourceDomain || src.source?.domain)) update.sourceDomain = src.sourceDomain || src.source?.domain;
    if (!tpl.tags && Array.isArray(src.tags)) update.tags = src.tags;

    if (Object.keys(update).length === 0) { alreadyGood++; continue; }

    toUpdate.push({
      id: tpl._id,
      sourceGenerationId: tpl.sourceGenerationId,
      before: { name: tpl.name, description: tpl.description },
      after: update,
    });
  }

  console.log(`Already good:        ${alreadyGood}`);
  console.log(`No sourceGenerationId: ${noSourceLink}`);
  console.log(`Source doc missing:  ${sourceMissing}`);
  console.log(`Will update:         ${toUpdate.length}`);

  if (toUpdate.length > 0) {
    console.log(`\nFirst 10 changes:`);
    for (const u of toUpdate.slice(0, 10)) {
      const newName = u.after.name || "(name unchanged)";
      console.log(`  ${u.sourceGenerationId.slice(0, 28).padEnd(28)} → "${newName}"`);
    }
    if (toUpdate.length > 10) console.log(`  … and ${toUpdate.length - 10} more`);
  }

  if (!apply) {
    console.log(`\nDry-run only. Re-run with --apply to write the updates.`);
    await client.close();
    return;
  }

  if (toUpdate.length === 0) {
    console.log(`\nNothing to do.`);
    await client.close();
    return;
  }

  console.log(`\nApplying ${toUpdate.length} updates...`);
  let ok = 0;
  for (const u of toUpdate) {
    const result = await templates.updateOne({ _id: u.id }, { $set: u.after });
    if (result.modifiedCount > 0) ok++;
  }
  console.log(`Updated ${ok} / ${toUpdate.length} templates.`);

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
