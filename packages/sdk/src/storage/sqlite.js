"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteStorage = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
let Database;
class SQLiteStorage {
    db;
    dbPath;
    assetsDir;
    constructor(dbPath = "./data/canvas.db") {
        this.dbPath = dbPath;
        this.assetsDir = (0, path_1.join)((0, path_1.dirname)(dbPath), "assets");
    }
    async initialize() {
        const dir = (0, path_1.dirname)(this.dbPath);
        if (!(0, fs_1.existsSync)(dir))
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        if (!(0, fs_1.existsSync)(this.assetsDir))
            (0, fs_1.mkdirSync)(this.assetsDir, { recursive: true });
        try {
            const m = await import("better-sqlite3");
            Database = m.default ?? m;
        }
        catch {
            throw new Error("Run: npm install better-sqlite3");
        }
        this.db = new Database(this.dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, design_system TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
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
    }
    async close() { this.db?.close(); }
    async createProject(d) {
        this.db.prepare("INSERT INTO projects (id,title,design_system,created_at,updated_at) VALUES (?,?,?,?,?)")
            .run(d.id, d.title, d.designSystem ? JSON.stringify(d.designSystem) : null, d.createdAt, d.updatedAt);
    }
    async getProject(id) {
        const r = this.db.prepare("SELECT * FROM projects WHERE id=?").get(id);
        return r ? { id: r.id, title: r.title, designSystem: r.design_system ? JSON.parse(r.design_system) : undefined,
            screens: [], createdAt: r.created_at, updatedAt: r.updated_at } : null;
    }
    async listProjects() {
        return this.db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all()
            .map((r) => ({ id: r.id, title: r.title, screens: [], createdAt: r.created_at, updatedAt: r.updated_at }));
    }
    async updateProject(id, d) {
        if (d.title)
            this.db.prepare("UPDATE projects SET title=?,updated_at=datetime('now') WHERE id=?").run(d.title, id);
    }
    async deleteProject(id) { this.db.prepare("DELETE FROM projects WHERE id=?").run(id); }
    async createScreen(pid, d) {
        this.db.prepare("INSERT INTO screens (id,project_id,prompt,html,screenshot,device_type,component_tree,design_tokens,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
            .run(d.id, pid, d.prompt, d.html, d.screenshot ?? null, d.deviceType, d.componentTree ? JSON.stringify(d.componentTree) : null, d.designTokens ? JSON.stringify(d.designTokens) : null, d.createdAt, d.updatedAt);
    }
    async getScreen(pid, sid) {
        const r = this.db.prepare("SELECT * FROM screens WHERE project_id=? AND id=?").get(pid, sid);
        return r ? { id: r.id, projectId: r.project_id, prompt: r.prompt, html: r.html,
            screenshot: r.screenshot, deviceType: r.device_type,
            componentTree: r.component_tree ? JSON.parse(r.component_tree) : undefined,
            designTokens: r.design_tokens ? JSON.parse(r.design_tokens) : undefined,
            createdAt: r.created_at, updatedAt: r.updated_at } : null;
    }
    async listScreens(pid) {
        return this.db.prepare("SELECT * FROM screens WHERE project_id=? ORDER BY created_at").all(pid)
            .map((r) => ({ id: r.id, projectId: r.project_id, prompt: r.prompt, html: r.html,
            deviceType: r.device_type, createdAt: r.created_at, updatedAt: r.updated_at }));
    }
    async updateScreen(pid, sid, d) {
        if (d.html)
            this.db.prepare("UPDATE screens SET html=?,updated_at=datetime('now') WHERE project_id=? AND id=?").run(d.html, pid, sid);
        if (d.screenshot)
            this.db.prepare("UPDATE screens SET screenshot=?,updated_at=datetime('now') WHERE project_id=? AND id=?").run(d.screenshot, pid, sid);
    }
    async deleteScreen(pid, sid) {
        this.db.prepare("DELETE FROM screens WHERE project_id=? AND id=?").run(pid, sid);
    }
    async setDesignSystem(pid, ds) {
        this.db.prepare("UPDATE projects SET design_system=?,updated_at=datetime('now') WHERE id=?").run(JSON.stringify(ds), pid);
    }
    async getDesignSystem(pid) {
        const r = this.db.prepare("SELECT design_system FROM projects WHERE id=?").get(pid);
        return r?.design_system ? JSON.parse(r.design_system) : null;
    }
    async saveAsset(key, data) {
        const safe = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
        const fp = (0, path_1.join)(this.assetsDir, safe);
        typeof data === "string" ? (0, fs_1.writeFileSync)(fp, data, "utf-8") : (0, fs_1.writeFileSync)(fp, data);
        this.db.prepare("INSERT OR REPLACE INTO assets (key,file_path,size_bytes,created_at) VALUES (?,?,?,datetime('now'))")
            .run(key, fp, typeof data === "string" ? Buffer.byteLength(data) : data.length);
        return fp;
    }
    async getAsset(key) {
        const r = this.db.prepare("SELECT file_path FROM assets WHERE key=?").get(key);
        if (!r)
            return null;
        try {
            return (0, fs_1.readFileSync)(r.file_path);
        }
        catch {
            return null;
        }
    }
    async deleteAsset(key) {
        const r = this.db.prepare("SELECT file_path FROM assets WHERE key=?").get(key);
        if (r)
            try {
                (0, fs_1.unlinkSync)(r.file_path);
            }
            catch { }
        this.db.prepare("DELETE FROM assets WHERE key=?").run(key);
    }
    // --- Component Library ---
    async saveComponent(d) {
        this.db.prepare(`INSERT OR REPLACE INTO components (id,category,name,description,html,tokens,slots,variants,tags,source,adaptability,quality,usage_count,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(d.id, d.category, d.name, d.description, d.html, JSON.stringify(d.tokens), JSON.stringify(d.slots), JSON.stringify(d.variants), JSON.stringify(d.tags), d.source, d.adaptability, d.quality, d.usageCount || 0, d.createdAt, d.updatedAt);
    }
    async getComponent(id) {
        const r = this.db.prepare("SELECT * FROM components WHERE id=?").get(id);
        return r ? this._mapComponent(r) : null;
    }
    async listComponents(category) {
        const rows = category
            ? this.db.prepare("SELECT * FROM components WHERE category=? ORDER BY quality DESC, usage_count DESC").all(category)
            : this.db.prepare("SELECT * FROM components ORDER BY quality DESC, usage_count DESC").all();
        return rows.map((r) => this._mapComponent(r));
    }
    async searchComponents(query) {
        const rows = this.db.prepare("SELECT * FROM components WHERE name LIKE ? OR description LIKE ? OR tags LIKE ? ORDER BY quality DESC")
            .all(`%${query}%`, `%${query}%`, `%${query}%`);
        return rows.map((r) => this._mapComponent(r));
    }
    async deleteComponent(id) {
        this.db.prepare("DELETE FROM components WHERE id=?").run(id);
    }
    async incrementComponentUsage(id) {
        this.db.prepare("UPDATE components SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id=?").run(id);
    }
    _mapComponent(r) {
        return {
            id: r.id, category: r.category, name: r.name, description: r.description || "",
            html: r.html, thumbnail: r.thumbnail,
            tokens: r.tokens ? JSON.parse(r.tokens) : { colors: [], fonts: [], radius: false },
            slots: r.slots ? JSON.parse(r.slots) : [],
            variants: r.variants ? JSON.parse(r.variants) : [],
            tags: r.tags ? JSON.parse(r.tags) : [],
            source: r.source || "curated", adaptability: r.adaptability || "flexible",
            quality: r.quality || 3, usageCount: r.usage_count || 0,
            createdAt: r.created_at, updatedAt: r.updated_at,
        };
    }
}
exports.SQLiteStorage = SQLiteStorage;
//# sourceMappingURL=sqlite.js.map