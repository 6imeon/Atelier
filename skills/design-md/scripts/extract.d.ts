export declare function extractFromURL(url: string, projectId?: string): Promise<string>;
export declare function fromScreen(projectId: string, screenId: string): Promise<string>;
export declare function mergeDesignMds(...mds: string[]): string;
export declare function validateDesignMd(md: string): {
    valid: boolean;
    missing: string[];
};
