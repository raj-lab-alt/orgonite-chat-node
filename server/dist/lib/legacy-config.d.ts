interface LegacyConfig {
    catalogItemTemplate?: string;
    welcomeMessage?: string;
    facebookPixelIds?: string[];
    googleAnalyticsIds?: string[];
    statuses?: string[];
    products?: any[];
    services?: any[];
}
export declare function getLegacyConfig(): LegacyConfig;
export declare function getLegacyProducts(): any[];
export declare function getLegacyServices(): any[];
export declare function getLegacyStatuses(): string[];
export {};
//# sourceMappingURL=legacy-config.d.ts.map