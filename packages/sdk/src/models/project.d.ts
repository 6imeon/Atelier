import { Screen, ScreenData, DeviceType } from "./screen.js";
import { DesignSystem } from "./design-system.js";
import { ComponentLibrary } from "./component.js";
export type ProgressCallback = (stage: string, detail?: string) => void;
export interface ProjectData {
    id: string;
    title: string;
    designSystem?: DesignSystem;
    screens: ScreenData[];
    createdAt: string;
    updatedAt: string;
}
export declare class Project {
    readonly id: string;
    readonly title: string;
    private _designSystem;
    private _screens;
    private _componentLibrary;
    constructor(data: ProjectData);
    screens(): Promise<Screen[]>;
    getScreen(id: string): Promise<Screen | null>;
    getDesignSystem(): DesignSystem | null;
    setDesignSystem(ds: DesignSystem): void;
    getComponentLibrary(): ComponentLibrary | null;
    setComponentLibrary(lib: ComponentLibrary): void;
    /**
     * Fetch a page using crawl4ai (if available) with fallback to direct fetch.
     * crawl4ai uses a headless browser so it can bypass bot protection.
     */
    private _fetchPage;
    /**
     * Check if fetched HTML is a bot challenge/empty shell rather than real content.
     */
    private _isBlocked;
    /**
     * Strip non-content HTML elements, keeping structure and text.
     */
    private _stripHtml;
    /**
     * Extract plain text content from HTML.
     */
    private _extractText;
    /**
     * Extract brand/company name from HTML title tag or meta tags.
     * Falls back to domain-based guess.
     */
    private _extractBrandName;
    generate(prompt: string, deviceType?: DeviceType, onProgress?: ProgressCallback): Promise<Screen>;
    generateFromImage(imageBase64: string, prompt?: string, deviceType?: DeviceType): Promise<Screen>;
    redesignFromURL(url: string, prompt: string, deviceType?: DeviceType, onProgress?: ProgressCallback): Promise<Screen>;
    /**
     * Plan a redesign: analyze the site and propose pages + design system name.
     * Returns a structured plan without generating any HTML.
     */
    planRedesign(url: string, userPrompt?: string, onProgress?: ProgressCallback): Promise<{
        brandName: string;
        designSystemName: string;
        analysis: string;
        proposedPages: Array<{
            title: string;
            description: string;
        }>;
        designTokens: Record<string, unknown>;
        fetchedContent: {
            textContent: string;
            stripped: string;
            fetchSucceeded: boolean;
        };
    }>;
    /**
     * Generate a single page as part of a multi-page redesign.
     * Uses pre-fetched content from planRedesign() to avoid re-crawling.
     */
    generatePage(url: string, pageTitle: string, pageDescription: string, brandName: string, fetchedContent: {
        textContent: string;
        stripped: string;
        fetchSucceeded: boolean;
    }, designTokens: Record<string, unknown>, deviceType?: DeviceType, onProgress?: ProgressCallback): Promise<Screen>;
    extractDesignFromURL(url: string): Promise<Record<string, unknown>>;
    toJSON(): ProjectData;
}
