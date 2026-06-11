interface EnhanceResult {
    original: string;
    enhanced: string;
    components: string[];
    layoutHint: string;
    confidence: number;
}
export declare function enhancePrompt(prompt: string, opts?: {
    device?: string;
    style?: string;
}): Promise<EnhanceResult>;
export {};
