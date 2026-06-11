import { StorageAdapter } from "../storage/interface.js";
export interface ScreenshotResult {
    buffer: Buffer;
    width: number;
    height: number;
    assetKey: string;
}
export declare class ScreenshotService {
    private browser;
    private storage;
    constructor(storage?: StorageAdapter);
    private ensureBrowser;
    capture(html: string, device?: string, scale?: number): Promise<ScreenshotResult>;
    thumbnail(html: string, device?: string): Promise<ScreenshotResult>;
    close(): Promise<void>;
}
export declare function getScreenshotService(storage?: StorageAdapter): ScreenshotService;
