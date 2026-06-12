interface Product {
    id: string;
    name: string;
    price: number;
    currency: string;
    benefits?: string;
    composition?: string;
    taille?: string;
    [key: string]: unknown;
}
export declare function getSystemPrompt(catalogItems?: Product[], systemPrompt?: string, catalogTemplate?: string, productType?: string): string;
export {};
//# sourceMappingURL=prompt.d.ts.map