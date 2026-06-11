/**
 * Clear brand cache for a domain.
 *
 * Usage:
 *   npx tsx scripts/clear-brand-cache.ts <domain>
 *   npx tsx scripts/clear-brand-cache.ts people-made.com
 *   npx tsx scripts/clear-brand-cache.ts --all          # clear everything
 *   npx tsx scripts/clear-brand-cache.ts --list         # list cached domains
 */

import { resolve } from "path";
import { readFileSync, existsSync } from "fs";

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

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error("MONGO_URI not set in .env"); process.exit(1); }

  const arg = process.argv[2];
  if (!arg) {
    console.log("Usage:");
    console.log("  npx tsx scripts/clear-brand-cache.ts <domain>");
    console.log("  npx tsx scripts/clear-brand-cache.ts --list");
    console.log("  npx tsx scripts/clear-brand-cache.ts --all");
    process.exit(0);
  }

  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("atelier");
  const brandCache = db.collection("brand_cache");

  if (arg === "--list") {
    const docs = await brandCache.find({}, { projection: { domain: 1, extractedAt: 1, useCount: 1, "fonts.heading.family": 1, "fonts.body.family": 1, logoUrl: 1 } }).sort({ lastUsed: -1 }).toArray();
    if (docs.length === 0) {
      console.log("No cached domains.");
    } else {
      console.log(`\n${docs.length} cached domain(s):\n`);
      for (const d of docs) {
        const heading = d.fonts?.heading?.family || "-";
        const body = d.fonts?.body?.family || "-";
        const logo = d.logoUrl ? "yes" : "no";
        const age = d.extractedAt ? Math.round((Date.now() - new Date(d.extractedAt).getTime()) / 86400000) + "d ago" : "?";
        console.log(`  ${d.domain.padEnd(30)} fonts: ${heading}/${body}  logo: ${logo}  used: ${d.useCount || 0}x  extracted: ${age}`);
      }
    }
  } else if (arg === "--all") {
    const result = await brandCache.deleteMany({});
    console.log(`Cleared all ${result.deletedCount} cached domain(s).`);
  } else {
    const domain = arg.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    const result = await brandCache.deleteOne({ domain });
    if (result.deletedCount > 0) {
      console.log(`Cleared cache for ${domain}. Next redesign will re-extract brand data.`);
    } else {
      console.log(`No cache entry found for ${domain}.`);
    }
  }

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
