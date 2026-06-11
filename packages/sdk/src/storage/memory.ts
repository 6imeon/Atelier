import { StorageAdapter } from "./interface.js";
import { ProjectData, UserData, ListProjectsOptions } from "../models/project.js";
import { ScreenData } from "../models/screen.js";
import { DesignSystem } from "../models/design-system.js";
import type { UIComponentData, ComponentCategory } from "../models/component.js";

export class MemoryStorage implements StorageAdapter {
  private projects = new Map<string, ProjectData>();
  private screens = new Map<string, Map<string, ScreenData>>();
  private designSystems = new Map<string, DesignSystem>();
  private canvasDesignSystems = new Map<string, unknown>();
  private assets = new Map<string, Buffer | string>();
  private components = new Map<string, UIComponentData>();
  private users = new Map<string, UserData>();

  async initialize() {}
  async close() { this.projects.clear(); this.screens.clear(); this.assets.clear(); this.users.clear(); }

  // --- Users ---
  async upsertUser(d: UserData) { this.users.set(d.id, d); }
  async getUser(id: string) { return this.users.get(id) ?? null; }
  async getUserByEntraOid(oid: string) {
    for (const u of this.users.values()) { if (u.entraOid === oid) return u; }
    return null;
  }

  // --- Projects ---
  async createProject(d: ProjectData) {
    if (!d.lastAccessedAt) d.lastAccessedAt = new Date().toISOString();
    this.projects.set(d.id, d); this.screens.set(d.id, new Map());
  }
  async getProject(id: string) { return this.projects.get(id) ?? null; }
  async listProjects(opts?: ListProjectsOptions): Promise<{ projects: ProjectData[]; nextCursor?: string }> {
    let all = [...this.projects.values()];
    if (opts?.ownerId) all = all.filter(p => p.ownerId === opts.ownerId);
    if (!opts?.includeExpired) {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      all = all.filter(p => !p.lastAccessedAt || p.lastAccessedAt > cutoff);
    }
    all.sort((a, b) => (b.lastAccessedAt ?? b.updatedAt).localeCompare(a.lastAccessedAt ?? a.updatedAt));
    if (opts?.cursor) all = all.filter(p => (p.lastAccessedAt ?? p.updatedAt) < opts.cursor!);
    const limit = Math.min(opts?.limit ?? 50, 100);
    const page = all.slice(0, limit);
    return {
      projects: page,
      nextCursor: all.length > limit ? (page[page.length - 1].lastAccessedAt ?? page[page.length - 1].updatedAt) : undefined,
    };
  }
  async updateProject(id: string, d: Partial<ProjectData>) {
    const e = this.projects.get(id); if (!e) throw new Error("Not found");
    this.projects.set(id, { ...e, ...d, updatedAt: new Date().toISOString() });
  }
  async deleteProject(id: string) { this.projects.delete(id); this.screens.delete(id); }
  async touchProject(id: string) {
    const p = this.projects.get(id); if (p) p.lastAccessedAt = new Date().toISOString();
  }
  async deleteStaleProjects(cutoffDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000).toISOString();
    let count = 0;
    for (const [id, p] of this.projects) {
      if (p.lastAccessedAt && p.lastAccessedAt < cutoff) { this.projects.delete(id); this.screens.delete(id); count++; }
    }
    return count;
  }

  async createScreen(pid: string, d: ScreenData) {
    let m = this.screens.get(pid); if (!m) { m = new Map(); this.screens.set(pid, m); } m.set(d.id, d);
  }
  async getScreen(pid: string, sid: string) { return this.screens.get(pid)?.get(sid) ?? null; }
  async listScreens(pid: string) { return [...(this.screens.get(pid)?.values() ?? [])]; }
  async updateScreen(pid: string, sid: string, d: Partial<ScreenData>) {
    const m = this.screens.get(pid); const e = m?.get(sid); if (!e) throw new Error("Not found");
    m!.set(sid, { ...e, ...d, updatedAt: new Date().toISOString() });
  }
  async deleteScreen(pid: string, sid: string) { this.screens.get(pid)?.delete(sid); }

  async setDesignSystem(pid: string, ds: DesignSystem) { this.designSystems.set(pid, ds); }
  async getDesignSystem(pid: string) { return this.designSystems.get(pid) ?? null; }
  async setCanvasDesignSystem(pid: string, ds: unknown) { this.canvasDesignSystems.set(pid, ds); }
  async getCanvasDesignSystem(pid: string) { return this.canvasDesignSystems.get(pid) ?? null; }

  async saveAsset(key: string, data: Buffer | string) { this.assets.set(key, data); return `mem://${key}`; }
  async getAsset(key: string) { return this.assets.get(key) ?? null; }
  async deleteAsset(key: string) { this.assets.delete(key); }

  // Component library
  async saveComponent(d: UIComponentData) { this.components.set(d.id, d); }
  async getComponent(id: string) { return this.components.get(id) ?? null; }
  async listComponents(category?: ComponentCategory) {
    const all = [...this.components.values()];
    return category ? all.filter(c => c.category === category) : all;
  }
  async searchComponents(query: string) {
    const q = query.toLowerCase();
    return [...this.components.values()].filter(c =>
      c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q))
    );
  }
  async deleteComponent(id: string) { this.components.delete(id); }
  async incrementComponentUsage(id: string) {
    const c = this.components.get(id);
    if (c) c.usageCount++;
  }
}
