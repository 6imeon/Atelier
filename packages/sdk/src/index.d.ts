import { Project } from "./models/project.js";
export { Screen, ScreenData, DeviceType, VariantOptions, ComponentNode } from "./models/screen.js";
export { Project, ProjectData } from "./models/project.js";
export { DesignSystem, toDesignMd, parseDesignMd } from "./models/design-system.js";
export { ModelRouter, RouterError, MODEL_CONFIG, getRouter } from "./utils/router.js";
export type { PipelineStage, ChatMessage } from "./utils/router.js";
export { PROMPTS } from "./utils/prompts.js";
export { extractBrandData, extractBrandDataFull } from "./utils/brand-extractor.js";
export type { BrandData, ExtractedColors, ExtractedFonts, ExtractedFont, ExtractedLogo, ColorInfo } from "./utils/brand-extractor.js";
export { ComponentLibrary } from "./models/component.js";
export type { UIComponentData, ComponentCategory, ComponentSlot, ComponentVariant, Adaptability, ComponentSelection } from "./models/component.js";
export { createStorage } from "./storage/interface.js";
export type { StorageAdapter, StorageBackend } from "./storage/interface.js";
export declare class CanvasAI {
    private router;
    private _projects;
    constructor(opts?: {
        apiKey?: string;
    });
    createProject(title: string): Project;
    project(id: string): Project;
    projects(): Promise<Project[]>;
}
export declare function getCanvasAI(opts?: {
    apiKey?: string;
}): CanvasAI;
export declare const canvas: CanvasAI;
