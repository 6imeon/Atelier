import { route, authenticate, rateLimit, body, json, validateRequired, componentLibrary, analytics, PORT } from "../shared";
import type { UIComponentData, ComponentCategory } from "@canvas-ai/sdk";

export function templateToComponent(doc: any): UIComponentData {
  const id = doc.sourceGenerationId || doc._id?.toString() || `tpl_${Date.now()}`;
  const category = (doc.type || "content") as ComponentCategory;
  const brand = doc.brandName || doc.sourceDomain || doc.industry;
  // Build a meaningful fallback name when the upstream engine doc didn't
  // store one. Prefer brand/domain over the generic "(multi)" tag.
  const fallbackName = brand
    ? `${category.charAt(0).toUpperCase() + category.slice(1)} — ${brand}${doc.style ? ` (${doc.style})` : ""}`
    : `${category}${doc.industry ? ` (${doc.industry})` : ""}`;
  const fallbackDesc = brand
    ? `Approved ${category} from ${brand}${doc.style ? `, ${doc.style} style` : ""}`
    : `Approved ${category} component`;
  const tags = [doc.industry, doc.style, doc.brandName, doc.sourceDomain, ...(Array.isArray(doc.tags) ? doc.tags : [])].filter(Boolean) as string[];
  return {
    id: `tpl_${id}`,
    category,
    name: doc.name || fallbackName,
    description: doc.description || fallbackDesc,
    html: doc.html || "",
    tokens: { colors: ["primary"], fonts: ["body"], radius: true },
    slots: [],
    variants: [],
    tags,
    source: "approved",
    adaptability: "flexible",
    quality: doc.qualityScore || 3,
    positiveRatings: doc.positiveRatings || 0,
    negativeRatings: doc.negativeRatings || 0,
    compositeScore: doc.compositeScore || doc.qualityScore || 3,
    elo: doc.elo || { rating: 1500, matches: 0, wins: 0, sigma: 350 },
    usageCount: doc.timesReused || 0,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : (doc.createdAt || new Date().toISOString()),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : (doc.updatedAt || new Date().toISOString()),
  };
}

async function loadApprovedTemplates(): Promise<UIComponentData[]> {
  if (!analytics) return [];
  try {
    const db = (analytics as any).db as import("mongodb").Db | undefined;
    if (!db) return [];
    const docs = await db.collection("section_templates").find({}).toArray();
    return docs.map(templateToComponent);
  } catch {
    return [];
  }
}

/** Merge all approved section_templates into the shared componentLibrary so
 * matchComponentsForSection (which only reads the in-memory library) can
 * consider them during redesign. Called at boot and after each approve. */
export async function mergeApprovedIntoLibrary(): Promise<number> {
  const approved = await loadApprovedTemplates();
  for (const c of approved) componentLibrary.add(c);
  return approved.length;
}

/** Add a single approved template (by sourceGenerationId) to the library,
 * used by the approve endpoint for incremental freshness without reloading
 * every row. */
export async function mergeApprovedTemplateById(sourceGenerationId: string): Promise<boolean> {
  if (!analytics) return false;
  try {
    const db = (analytics as any).db as import("mongodb").Db | undefined;
    if (!db) return false;
    const doc = await db.collection("section_templates").findOne({ sourceGenerationId });
    if (!doc) return false;
    componentLibrary.add(templateToComponent(doc));
    return true;
  } catch {
    return false;
  }
}

export function registerComponentRoutes() {
  route("GET", "/api/components", async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const category = url.searchParams.get("category") as ComponentCategory | null;
    const query = url.searchParams.get("q");

    const approved = await loadApprovedTemplates();
    let components: UIComponentData[] = [...componentLibrary.all(), ...approved];

    if (category) components = components.filter(c => c.category === category);
    if (query) {
      const q = query.toLowerCase();
      components = components.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    json(res, { components, total: components.length });
  });

  route("GET", "/api/components/stats", async (_r, res) => {
    json(res, componentLibrary.stats());
  });

  route("GET", "/api/components/:id", async (_r, res, params) => {
    const approved = await loadApprovedTemplates();
    const all = [...componentLibrary.all(), ...approved];
    const comp = all.find(c => c.id === params.id);
    if (!comp) { json(res, { error: "Component not found" }, 404); return; }
    json(res, comp);
  });

  route("POST", "/api/components", async (req, res) => {
    await authenticate(req);
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["category", "name", "html"]);
    const comp: UIComponentData = {
      id: b.id || `${b.category}-${Date.now()}`,
      category: b.category,
      name: b.name,
      description: b.description || "",
      html: b.html,
      tokens: b.tokens || { colors: ["primary"], fonts: ["body"], radius: true },
      slots: b.slots || [],
      variants: b.variants || [],
      tags: b.tags || [],
      source: b.source || "curated",
      adaptability: b.adaptability || "flexible",
      quality: b.quality || 3,
      positiveRatings: 0,
      negativeRatings: 0,
      compositeScore: b.quality || 3,
      elo: { rating: 1500, matches: 0, wins: 0, sigma: 350 },
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    componentLibrary.add(comp);
    json(res, comp, 201);
  });

  route("POST", "/api/components/:id/customize", async (req, res, params) => {
    await authenticate(req);
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["instruction"]);
    const all = componentLibrary.all();
    const comp = all.find(c => c.id === params.id);
    if (!comp) { json(res, { error: "Component not found" }, 404); return; }
    const html = await componentLibrary.customizeComponent(comp, b.instruction);
    json(res, { html });
  });

  route("POST", "/api/components/generate", async (req, res) => {
    await authenticate(req);
    rateLimit(req);
    const b = await body(req);
    validateRequired(b, ["description", "category"]);
    const comp = await componentLibrary.generateComponent(b.description, b.category);
    componentLibrary.add(comp);
    json(res, comp, 201);
  });
}
