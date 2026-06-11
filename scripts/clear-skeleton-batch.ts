import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}

async function main() {
  const client = new MongoClient(process.env.MONGO_URI!);
  await client.connect();
  const db = client.db();
  const result = await db.collection("generated_components").deleteMany({ "source.domain": "skeleton-batch" });
  console.log(`Deleted ${result.deletedCount} skeleton-batch entries from generated_components`);
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
