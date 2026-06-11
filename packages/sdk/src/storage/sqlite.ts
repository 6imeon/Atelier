import { StorageAdapter } from "./interface.js";
import { ProjectData, UserData, ListProjectsOptions } from "../models/project.js";
import { ScreenData } from "../models/screen.js";
import { DesignSystem } from "../models/design-system.js";
import type { UIComponentData, ComponentCategory } from "../models/component.js";
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import { dirname, join } from "path";

let Database: any;

export class SQLiteStorage implements StorageAdapter {
  private db: any;
  private dbPath: string;
  private assetsDir: string;

  constructor(dbPath = "./data/canvas.db") {
    this.dbPath = dbPath;
    this.assetsDir = join(dirname(dbPath), "assets");
  }

  async initialize() {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (!existsSync(this.assetsDir)) mkdirSync(this.assetsDir, { recursive: true });
    try { const m = await import("better-sqlite3"); Database = m.default ?? m; }
    catch { throw new Error("Run: npm install better-sqlite3"); }
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        entra_oid TEXT UNIQUE,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_login TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_users_entra_oid ON users(entra_oid);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, design_system TEXT,
        canvas_design_system TEXT,
        owner_id TEXT REFERENCES users(id),
        last_accessed_at TEXT DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
      CREATE INDEX IF NOT EXISTS idx_projects_last_accessed ON projects(last_accessed_at);

      CREATE TABLE IF NOT EXISTS screens (
        id TEXT NOT NULL, project_id TEXT NOT NULL,
        prompt TEXT NOT NULL, html TEXT NOT NULL, screenshot TEXT,
        device_type TEXT NOT NULL DEFAULT 'DESKTOP',
        component_tree TEXT, design_tokens TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (project_id, id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_screens_project ON screens(project_id);
      CREATE TABLE IF NOT EXISTS assets (
        key TEXT PRIMARY KEY, file_path TEXT NOT NULL,
        size_bytes INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS components (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        html TEXT NOT NULL,
        thumbnail BLOB,
        tokens TEXT,
        slots TEXT,
        variants TEXT,
        tags TEXT,
        source TEXT DEFAULT 'curated',
        adaptability TEXT DEFAULT 'flexible',
        quality INTEGER DEFAULT 3,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_components_category ON components(category);
      CREATE INDEX IF NOT EXISTS idx_components_quality ON components(quality DESC);
      CREATE INDEX IF NOT EXISTS idx_components_usage ON components(usage_count DESC);
    `);

    // Migrate existing projects table: add owner_id and last_accessed_at if missing
    const cols = this.db.prepare("PRAGMA table_info(projects)").all().map((c: any) => c.name);
    if (!cols.includes("owner_id")) {
      this.db.exec("ALTER TABLE projects ADD COLUMN owner_id TEXT REFERENCES users(id)");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id)");
    }
    if (!cols.includes("last_accessed_at")) {
      this.db.exec("ALTER TABLE projects ADD COLUMN last_accessed_at TEXT DEFAULT (datetime('now'))");
      this.db.exec("CREATE INDEX IF NOT EXISTS idx_projects_last_accessed ON projects(last_accessed_at)");
    }
    if (!cols.includes("canvas_design_system")) {
      this.db.exec("ALTER TABLE projects ADD COLUMN canvas_design_system TEXT");
    }
  }

  async close() { this.db?.close(); }

  // --- Users ---

  async upsertUser(d: UserData) {
    this.db.prepare(`INSERT INTO users (id, entra_oid, email, display_name, avatar_url, created_at, last_login)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET email=excluded.email, display_name=excluded.display_name,
        avatar_url=excluded.avatar_url, last_login=excluded.last_login`)
      .run(d.id, d.entraOid ?? null, d.email, d.displayName, d.avatarUrl ?? null, d.createdAt, d.lastLogin);
  }

  async getUser(id: string): Promise<UserData | null> {
    const r = this.db.prepare("SELECT * FROM users WHERE id=?").get(id) as any;
    return r ? this._mapUser(r) : null;
  }

  async getUserByEntraOid(oid: string): Promise<UserData | null> {
    const r = this.db.prepare("SELECT * FROM users WHERE entra_oid=?").get(oid) as any;
    return r ? this._mapUser(r) : null;
  }

  private _mapUser(r: any): UserData {
    return { id: r.id, entraOid: r.entra_oid, email: r.email, displayName: r.display_name,
      avatarUrl: r.avatar_url, createdAt: r.created_at, lastLogin: r.last_login };
  }

  // --- Projects ---

  async createProject(d: ProjectData) {
    this.db.prepare("INSERT INTO projects (id,title,design_system,owner_id,last_accessed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
      .run(d.id, d.title, d.designSystem ? JSON.stringify(d.designSystem) : null,
        d.ownerId ?? null, d.lastAccessedAt ?? new Date().toISOString(), d.createdAt, d.updatedAt);
  }

  async getProject(id: string): Promise<ProjectData | null> {
    const r = this.db.prepare("SELECT * FROM projects WHERE id=?").get(id) as any;
    return r ? { id: r.id, title: r.title, designSystem: r.design_system ? JSON.parse(r.design_system) : undefined,
      screens: [], ownerId: r.owner_id, lastAccessedAt: r.last_accessed_at,
      createdAt: r.created_at, updatedAt: r.updated_at } : null;
  }

  async listProjects(opts?: ListProjectsOptions): Promise<{ projects: ProjectData[]; nextCursor?: string }> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (opts?.ownerId) {
      conditions.push("owner_id = ?");
      params.push(opts.ownerId);
    }
    if (!opts?.includeExpired) {
      conditions.push("(last_accessed_at > datetime('now', '-30 days') OR last_accessed_at IS NULL)");
    }
    if (opts?.cursor) {
      conditions.push("last_accessed_at < ?");
      params.push(opts.cursor);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(opts?.limit ?? 50, 100);
    params.push(limit + 1); // fetch one extra for cursor

    const rows = this.db.prepare(
      `SELECT * FROM projects ${where} ORDER BY last_accessed_at DESC LIMIT ?`
    ).all(...params) as any[];

    let nextCursor: string | undefined;
    if (rows.length > limit) {
      rows.pop();
      nextCursor = rows[rows.length - 1].last_accessed_at;
    }

    return {
      projects: rows.map((r: any) => ({
        id: r.id, title: r.title, screens: [],
        ownerId: r.owner_id, lastAccessedAt: r.last_accessed_at,
        createdAt: r.created_at, updatedAt: r.updated_at,
      })),
      nextCursor,
    };
  }

  async updateProject(id: string, d: Partial<ProjectData>) {
    if (d.title) this.db.prepare("UPDATE projects SET title=?,updated_at=datetime('now') WHERE id=?").run(d.title, id);
    if (d.ownerId !== undefined) this.db.prepare("UPDATE projects SET owner_id=?,updated_at=datetime('now') WHERE id=?").run(d.ownerId, id);
  }

  async deleteProject(id: string) { this.db.prepare("DELETE FROM projects WHERE id=?").run(id); }

  async touchProject(id: string) {
    this.db.prepare("UPDATE projects SET last_accessed_at=datetime('now') WHERE id=?").run(id);
  }

  async deleteStaleProjects(cutoffDays: number): Promise<number> {
    const result = this.db.prepare(
      `DELETE FROM projects WHERE last_accessed_at < datetime('now', '-' || ? || ' days') AND last_accessed_at IS NOT NULL`
    ).run(cutoffDays);
    return result.changes;
  }

  async createScreen(pid: string, d: ScreenData) {
    this.db.prepare("INSERT INTO screens (id,project_id,prompt,html,screenshot,device_type,component_tree,design_tokens,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(d.id, pid, d.prompt, d.html, d.screenshot ?? null, d.deviceType,
        d.componentTree ? JSON.stringify(d.componentTree) : null,
        d.designTokens ? JSON.stringify(d.designTokens) : null,
        d.createdAt, d.updatedAt);
  }
  async getScreen(pid: string, sid: string): Promise<ScreenData | null> {
    const r = this.db.prepare("SELECT * FROM screens WHERE project_id=? AND id=?").get(pid, sid);
    return r ? { id: r.id, projectId: r.project_id, prompt: r.prompt, html: r.html,
      screenshot: r.screenshot, deviceType: r.device_type,
      componentTree: r.component_tree ? JSON.parse(r.component_tree) : undefined,
      designTokens: r.design_tokens ? JSON.parse(r.design_tokens) : undefined,
      createdAt: r.created_at, updatedAt: r.updated_at } : null;
  }
  async listScreens(pid: string): Promise<ScreenData[]> {
    return this.db.prepare("SELECT * FROM screens WHERE project_id=? ORDER BY created_at").all(pid)
      .map((r: any) => ({ id: r.id, projectId: r.project_id, prompt: r.prompt, html: r.html,
        deviceType: r.device_type, createdAt: r.created_at, updatedAt: r.updated_at }));
  }
  async updateScreen(pid: string, sid: string, d: Partial<ScreenData>) {
    if (d.html) this.db.prepare("UPDATE screens SET html=?,updated_at=datetime('now') WHERE project_id=? AND id=?").run(d.html, pid, sid);
    if (d.screenshot) this.db.prepare("UPDATE screens SET screenshot=?,updated_at=datetime('now') WHERE project_id=? AND id=?").run(d.screenshot, pid, sid);
  }
  async deleteScreen(pid: string, sid: string) {
    this.db.prepare("DELETE FROM screens WHERE project_id=? AND id=?").run(pid, sid);
  }

  async setDesignSystem(pid: string, ds: DesignSystem) {
    this.db.prepare("UPDATE projects SET design_system=?,updated_at=datetime('now') WHERE id=?").run(JSON.stringify(ds), pid);
  }
  async getDesignSystem(pid: string): Promise<DesignSystem | null> {
    const r = this.db.prepare("SELECT design_system FROM projects WHERE id=?").get(pid);
    return r?.design_system ? JSON.parse(r.design_system) : null;
  }

  async setCanvasDesignSystem(pid: string, ds: unknown) {
    this.db.prepare("UPDATE projects SET canvas_design_system=?,updated_at=datetime('now') WHERE id=?").run(JSON.stringify(ds), pid);
  }
  async getCanvasDesignSystem(pid: string): Promise<unknown | null> {
    const r = this.db.prepare("SELECT canvas_design_system FROM projects WHERE id=?").get(pid);
    return r?.canvas_design_system ? JSON.parse(r.canvas_design_system) : null;
  }

  async saveAsset(key: string, data: Buffer | string) {
    const safe = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const fp = join(this.assetsDir, safe);
    if (typeof data === "string") writeFileSync(fp, data, "utf-8");
    else writeFileSync(fp, data);
    this.db.prepare("INSERT OR REPLACE INTO assets (key,file_path,size_bytes,created_at) VALUES (?,?,?,datetime('now'))")
      .run(key, fp, typeof data === "string" ? Buffer.byteLength(data) : data.length);
    return fp;
  }
  async getAsset(key: string) {
    const r = this.db.prepare("SELECT file_path FROM assets WHERE key=?").get(key);
    if (!r) return null;
    try { return readFileSync(r.file_path); } catch { return null; }
  }
  async deleteAsset(key: string) {
    const r = this.db.prepare("SELECT file_path FROM assets WHERE key=?").get(key);
    if (r) try { unlinkSync(r.file_path); } catch {}
    this.db.prepare("DELETE FROM assets WHERE key=?").run(key);
  }

  // --- Component Library ---

  async saveComponent(d: UIComponentData) {
    this.db.prepare(`INSERT OR REPLACE INTO components (id,category,name,description,html,tokens,slots,variants,tags,source,adaptability,quality,usage_count,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(d.id, d.category, d.name, d.description, d.html,
        JSON.stringify(d.tokens), JSON.stringify(d.slots), JSON.stringify(d.variants),
        JSON.stringify(d.tags), d.source, d.adaptability, d.quality, d.usageCount || 0,
        d.createdAt, d.updatedAt);
  }

  async getComponent(id: string): Promise<UIComponentData | null> {
    const r = this.db.prepare("SELECT * FROM components WHERE id=?").get(id) as any;
    return r ? this._mapComponent(r) : null;
  }

  async listComponents(category?: ComponentCategory): Promise<UIComponentData[]> {
    const rows = category
      ? this.db.prepare("SELECT * FROM components WHERE category=? ORDER BY quality DESC, usage_count DESC").all(category)
      : this.db.prepare("SELECT * FROM components ORDER BY quality DESC, usage_count DESC").all();
    return rows.map((r: any) => this._mapComponent(r));
  }

  async searchComponents(query: string): Promise<UIComponentData[]> {
    const rows = this.db.prepare("SELECT * FROM components WHERE name LIKE ? OR description LIKE ? OR tags LIKE ? ORDER BY quality DESC")
      .all(`%${query}%`, `%${query}%`, `%${query}%`);
    return rows.map((r: any) => this._mapComponent(r));
  }

  async deleteComponent(id: string) {
    this.db.prepare("DELETE FROM components WHERE id=?").run(id);
  }

  async incrementComponentUsage(id: string) {
    this.db.prepare("UPDATE components SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id=?").run(id);
  }

  private _mapComponent(r: any): UIComponentData {
    return {
      id: r.id, category: r.category, name: r.name, description: r.description || "",
      html: r.html, thumbnail: r.thumbnail,
      tokens: r.tokens ? JSON.parse(r.tokens) : { colors: [], fonts: [], radius: false },
      slots: r.slots ? JSON.parse(r.slots) : [],
      variants: r.variants ? JSON.parse(r.variants) : [],
      tags: r.tags ? JSON.parse(r.tags) : [],
      source: r.source || "curated", adaptability: r.adaptability || "flexible",
      quality: r.quality || 3,
      positiveRatings: r.positive_ratings || 0,
      negativeRatings: r.negative_ratings || 0,
      compositeScore: r.composite_score || r.quality || 3,
      elo: r.elo ? JSON.parse(r.elo) : { rating: 1500, matches: 0, wins: 0, sigma: 350 },
      usageCount: r.usage_count || 0,
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
}
