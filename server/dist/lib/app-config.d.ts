export declare const DEFAULT_STATUSES: string[];
export interface AppConfig {
    systemPrompt: string;
    catalogItemTemplate: string;
    welcomeMessage: string;
    facebookPixelIds: string[];
    googleAnalyticsIds: string[];
    statuses: string[];
    geminiApiKeys: string[];
    geminiModels: string[];
    source: "database" | "seed";
}
type AppConfigUpdate = Partial<Omit<AppConfig, "source">>;
export declare function maskApiKeys(apiKeys: string[]): string[];
export declare function getAppConfig(): Promise<AppConfig>;
export declare function updateAppConfig(update: AppConfigUpdate): Promise<AppConfig>;
export {};
//# sourceMappingURL=app-config.d.ts.map