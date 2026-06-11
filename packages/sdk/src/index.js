"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canvas = exports.CanvasAI = exports.createStorage = exports.ComponentLibrary = exports.extractBrandDataFull = exports.extractBrandData = exports.PROMPTS = exports.getRouter = exports.MODEL_CONFIG = exports.RouterError = exports.ModelRouter = exports.parseDesignMd = exports.toDesignMd = exports.Project = exports.Screen = void 0;
exports.getCanvasAI = getCanvasAI;
const project_js_1 = require("./models/project.js");
const router_js_1 = require("./utils/router.js");
var screen_js_1 = require("./models/screen.js");
Object.defineProperty(exports, "Screen", { enumerable: true, get: function () { return screen_js_1.Screen; } });
var project_js_2 = require("./models/project.js");
Object.defineProperty(exports, "Project", { enumerable: true, get: function () { return project_js_2.Project; } });
var design_system_js_1 = require("./models/design-system.js");
Object.defineProperty(exports, "toDesignMd", { enumerable: true, get: function () { return design_system_js_1.toDesignMd; } });
Object.defineProperty(exports, "parseDesignMd", { enumerable: true, get: function () { return design_system_js_1.parseDesignMd; } });
var router_js_2 = require("./utils/router.js");
Object.defineProperty(exports, "ModelRouter", { enumerable: true, get: function () { return router_js_2.ModelRouter; } });
Object.defineProperty(exports, "RouterError", { enumerable: true, get: function () { return router_js_2.RouterError; } });
Object.defineProperty(exports, "MODEL_CONFIG", { enumerable: true, get: function () { return router_js_2.MODEL_CONFIG; } });
Object.defineProperty(exports, "getRouter", { enumerable: true, get: function () { return router_js_2.getRouter; } });
var prompts_js_1 = require("./utils/prompts.js");
Object.defineProperty(exports, "PROMPTS", { enumerable: true, get: function () { return prompts_js_1.PROMPTS; } });
var brand_extractor_js_1 = require("./utils/brand-extractor.js");
Object.defineProperty(exports, "extractBrandData", { enumerable: true, get: function () { return brand_extractor_js_1.extractBrandData; } });
Object.defineProperty(exports, "extractBrandDataFull", { enumerable: true, get: function () { return brand_extractor_js_1.extractBrandDataFull; } });
var component_js_1 = require("./models/component.js");
Object.defineProperty(exports, "ComponentLibrary", { enumerable: true, get: function () { return component_js_1.ComponentLibrary; } });
var interface_js_1 = require("./storage/interface.js");
Object.defineProperty(exports, "createStorage", { enumerable: true, get: function () { return interface_js_1.createStorage; } });
class CanvasAI {
    router;
    _projects = new Map();
    constructor(opts = {}) { this.router = (0, router_js_1.getRouter)(opts); }
    createProject(title) {
        const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const p = new project_js_1.Project({ id, title, screens: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        this._projects.set(id, p);
        return p;
    }
    project(id) {
        if (this._projects.has(id))
            return this._projects.get(id);
        const p = new project_js_1.Project({ id, title: "", screens: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        this._projects.set(id, p);
        return p;
    }
    async projects() { return [...this._projects.values()]; }
}
exports.CanvasAI = CanvasAI;
let _inst = null;
function getCanvasAI(opts) {
    if (!_inst)
        _inst = new CanvasAI(opts);
    return _inst;
}
exports.canvas = new Proxy({}, {
    get(_, prop) { return getCanvasAI()[prop]; },
});
//# sourceMappingURL=index.js.map