/**
 * Export analytics data from MongoDB Atlas to JSON files.
 * Usage: npx tsx scripts/export-analytics.ts [collection] [--output dir]
 *
 * Examples:
 *   npx tsx scripts/export-analytics.ts                    # export all collections
 *   npx tsx scripts/export-analytics.ts generation_logs    # export one collection
 *   npx tsx scripts/export-analytics.ts --output ./backup  # custom output dir
 */
import { resolve } from "path";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { MongoClient } from "mongodb";

// Load .env
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

const DB_NAME = "atelier";
const ALL_COLLECTIONS = ["generation_logs", "brand_cache", "layout_examples", "section_templates", "user_feedback"];

async function main() {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf("--output");
  const outputDir = outputIdx >= 0 ? args[outputIdx + 1] : "./data/exports";
  const collectionArg = args.find(a => !a.startsWith("--") && a !== outputDir);
  const collections = collectionArg ? [collectionArg] : ALL_COLLECTIONS;

  const uri = process.env.MONGO_URI;
  if (!uri) { console.error("MONGO_URI not set in .env"); process.exit(1); }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(DB_NAME);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  for (const name of collections) {
    try {
      const docs = await db.collection(name).find({}).toArray();
      const path = resolve(outputDir, `${name}_${timestamp}.json`);
      writeFileSync(path, JSON.stringify(docs, null, 2));
      console.log(`[export] ${name}: ${docs.length} documents → ${path}`);
    } catch (err) {
      console.error(`[export] Failed to export ${name}:`, err instanceof Error ? err.message : err);
    }
  }

  await client.close();
  console.log("[export] Done.");
}

main();
