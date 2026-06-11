"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStorage = void 0;
class MemoryStorage {
    projects = new Map();
    screens = new Map();
    designSystems = new Map();
    assets = new Map();
    components = new Map();
    async initialize() { }
    async close() { this.projects.clear(); this.screens.clear(); this.assets.clear(); }
    async createProject(d) { this.projects.set(d.id, d); this.screens.set(d.id, new Map()); }
    async getProject(id) { return this.projects.get(id) ?? null; }
    async listProjects() { return [...this.projects.values()]; }
    async updateProject(id, d) {
        const e = this.projects.get(id);
        if (!e)
            throw new Error("Not found");
        this.projects.set(id, { ...e, ...d, updatedAt: new Date().toISOString() });
    }
    async deleteProject(id) { this.projects.delete(id); this.screens.delete(id); }
    async createScreen(pid, d) {
        let m = this.screens.get(pid);
        if (!m) {
            m = new Map();
            this.screens.set(pid, m);
        }
        m.set(d.id, d);
    }
    async getScreen(pid, sid) { return this.screens.get(pid)?.get(sid) ?? null; }
    async listScreens(pid) { return [...(this.screens.get(pid)?.values() ?? [])]; }
    async updateScreen(pid, sid, d) {
        const m = this.screens.get(pid);
        const e = m?.get(sid);
        if (!e)
            throw new Error("Not found");
        m.set(sid, { ...e, ...d, updatedAt: new Date().toISOString() });
    }
    async deleteScreen(pid, sid) { this.screens.get(pid)?.delete(sid); }
    async setDesignSystem(pid, ds) { this.designSystems.set(pid, ds); }
    async getDesignSystem(pid) { return this.designSystems.get(pid) ?? null; }
    async saveAsset(key, data) { this.assets.set(key, data); return `mem://${key}`; }
    async getAsset(key) { return this.assets.get(key) ?? null; }
    async deleteAsset(key) { this.assets.delete(key); }
    // Component library
    async saveComponent(d) { this.components.set(d.id, d); }
    async getComponent(id) { return this.components.get(id) ?? null; }
    async listComponents(category) {
        const all = [...this.components.values()];
        return category ? all.filter(c => c.category === category) : all;
    }
    async searchComponents(query) {
        const q = query.toLowerCase();
        return [...this.components.values()].filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) ||
            c.tags.some(t => t.toLowerCase().includes(q)));
    }
    async deleteComponent(id) { this.components.delete(id); }
    async incrementComponentUsage(id) {
        const c = this.components.get(id);
        if (c)
            c.usageCount++;
    }
}
exports.MemoryStorage = MemoryStorage;
//# sourceMappingURL=memory.js.map