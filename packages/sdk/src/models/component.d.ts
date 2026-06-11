export type ComponentCategory = "navbar" | "hero" | "features" | "cards" | "testimonials" | "pricing" | "cta" | "footer" | "forms" | "stats" | "team" | "gallery" | "faq" | "sidebar" | "modal" | "banner";
export type Adaptability = "rigid" | "flexible" | "fluid";
export interface ComponentSlot {
    name: string;
    type: "text" | "image" | "icon" | "list" | "richtext";
    placeholder: string;
    required: boolean;
}
export interface ComponentVariant {
    id: string;
    name: string;
    html: string;
    preview?: string;
}
export interface UIComponentData {
    id: string;
    category: ComponentCategory;
    name: string;
    description: string;
    html: string;
    thumbnail?: string;
    tokens: {
        colors: string[];
        fonts: string[];
        radius: boolean;
    };
    slots: ComponentSlot[];
    variants: ComponentVariant[];
    tags: string[];
    source: string;
    adaptability: Adaptability;
    quality: number;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
}
export interface ComponentSelection {
    matched: Array<{
        component: UIComponentData;
        adaptationNotes: string;
    }>;
    gaps: string[];
}
export declare class ComponentLibrary {
    private _components;
    /** Load components from an array (e.g., from storage) */
    load(components: UIComponentData[]): void;
    /** Add a single component */
    add(component: UIComponentData): void;
    /** Get all components */
    all(): UIComponentData[];
    /** Get components by category */
    getByCategory(category: ComponentCategory): UIComponentData[];
    /** Search components by description/name/tags */
    search(query: string): UIComponentData[];
    /** Get top components by usage */
    topUsed(limit?: number): UIComponentData[];
    /** AI-powered: select best components for a prompt and identify gaps */
    selectForPrompt(prompt: string, designContext?: string): Promise<ComponentSelection>;
    /**
     * Format selected components as prompt context for the layout generator.
     * Only sends the HTML for matched components, not the entire library.
     */
    toPromptContext(selection: ComponentSelection): string;
    /** AI: customize a component with natural language */
    customizeComponent(component: UIComponentData, instruction: string): Promise<string>;
    /** AI: generate a new component from description, optionally matching a style reference */
    generateComponent(description: string, category: ComponentCategory, styleReference?: UIComponentData): Promise<UIComponentData>;
    /** Record that a component was used in a generation */
    recordUsage(componentId: string): void;
    /** Get library stats */
    stats(): {
        total: number;
        byCategory: Record<string, number>;
        bySource: Record<string, number>;
    };
}
