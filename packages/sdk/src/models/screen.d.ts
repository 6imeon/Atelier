export type DeviceType = "MOBILE" | "DESKTOP" | "TABLET" | "AGNOSTIC";
export type CreativeRange = "REFINE" | "EXPLORE" | "REIMAGINE";
export type DesignAspect = "LAYOUT" | "COLOR_SCHEME" | "IMAGES" | "TEXT_FONT" | "TEXT_CONTENT";
export interface VariantOptions {
    variantCount?: number;
    creativeRange?: CreativeRange;
    aspects?: DesignAspect[];
}
export interface ComponentNode {
    type: string;
    props: Record<string, unknown>;
    children?: ComponentNode[];
    styles?: Record<string, string>;
}
export interface ScreenData {
    id: string;
    projectId: string;
    prompt: string;
    html: string;
    screenshot?: string;
    deviceType: DeviceType;
    designTokens?: Record<string, unknown>;
    componentTree?: ComponentNode;
    createdAt: string;
    updatedAt: string;
}
export declare class Screen {
    readonly id: string;
    readonly projectId: string;
    readonly prompt: string;
    readonly deviceType: DeviceType;
    private _html;
    private _screenshot;
    private _componentTree;
    constructor(data: ScreenData);
    getHtml(): Promise<string>;
    getScreenshot(): Promise<string>;
    edit(prompt: string, deviceType?: DeviceType): Promise<Screen>;
    variants(prompt: string, opts?: VariantOptions): Promise<Screen[]>;
    exportReact(): Promise<string>;
    toJSON(): ScreenData;
}
