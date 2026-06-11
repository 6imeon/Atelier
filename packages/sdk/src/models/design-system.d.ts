export interface DesignSystem {
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        surface: string;
        text: {
            primary: string;
            secondary: string;
            muted: string;
        };
    };
    typography: {
        fontFamilies: {
            heading: string;
            body: string;
            mono: string;
        };
        scale: Record<string, string>;
    };
    spacing: {
        unit: string;
        scale: string[];
    };
    borderRadius: Record<string, string>;
    shadows: Record<string, string>;
    componentPatterns: Array<{
        name: string;
        description: string;
        tailwindClasses: string;
    }>;
}
export declare function toDesignMd(ds: DesignSystem): string;
export declare function parseDesignMd(md: string): Partial<DesignSystem>;
