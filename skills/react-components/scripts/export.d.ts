interface ExportedComponent {
    name: string;
    code: string;
    filePath: string;
}
interface ExportResult {
    components: ExportedComponent[];
    screenId: string;
    projectId: string;
}
export declare function exportReactComponents(projectId: string, screenId: string, opts?: {
    split?: boolean;
}): Promise<ExportResult>;
export {};
