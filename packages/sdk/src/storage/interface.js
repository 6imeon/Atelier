"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStorage = createStorage;
async function createStorage(backend = "memory", opts = {}) {
    if (backend === "sqlite") {
        const { SQLiteStorage } = await import("./sqlite.js");
        const s = new SQLiteStorage(opts.path);
        await s.initialize();
        return s;
    }
    const { MemoryStorage } = await import("./memory.js");
    const s = new MemoryStorage();
    await s.initialize();
    return s;
}
//# sourceMappingURL=interface.js.map