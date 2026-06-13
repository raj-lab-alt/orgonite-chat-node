export interface OrderData {
    id?: string;
    nom: string;
    telephone: string;
    telephone2?: string;
    gouvernorat?: string;
    adresse?: string;
    produit?: string;
    prixProduit?: number;
    fraisLivraison?: number;
    totalCommande?: number;
    nombreArticles?: number;
    formatPersonnalise?: string;
    dateNaissance?: string;
    signeAstrologique?: string;
    cheminVie?: string;
    nombreAme?: string;
    nombrePersonnalite?: string;
    compositionPersonnalisee?: string;
    briefFabrication?: string;
    notes?: string;
    statut?: string;
    remplace_commande?: string;
    fusion_avec?: string;
    [key: string]: unknown;
}
export declare function generateOrderId(): string;
export declare function normalizeOrderPayload(data: OrderData): OrderData;
export declare function appendNote(existing: string, note: string): string;
export declare function calculateOrderAmounts(produit: string, products?: {
    name: string;
    price: number;
    id: string;
}[]): {
    prixProduit: number;
    nombreArticles: number;
    fraisLivraison: number;
    totalCommande: number;
};
export declare function applyOrderAmounts(data: OrderData, products: {
    name: string;
    price: number;
    id: string;
}[]): void;
export declare function normalizePhone(phone: string): string;
export declare function normalizeOrderText(str: string): string;
export declare function saveOrderWithoutDuplicate(data: OrderData, statuses: string[], products: {
    name: string;
    price: number;
    id: string;
}[]): Promise<{
    order: OrderData;
    created: boolean;
}>;
export declare function orderResponse(order: OrderData, created: boolean): {
    id: string | undefined;
    nom: string;
    produit: string;
    statut: string;
    prixProduit: number;
    fraisLivraison: number;
    totalCommande: number;
    nombreArticles: number;
    notes: string;
    created: boolean;
};
export declare function detectOrderFromReply(replyText: string): {
    cleanReply: string;
    orderData: OrderData | null;
};
export declare function detectProductsFromReply(replyText: string, dbProducts: {
    id: string;
    name: string;
    [key: string]: unknown;
}[], options?: {
    productId?: string | null;
    productType?: string;
    userMessage?: string;
}): {
    productData: unknown | null;
    productList: unknown[];
};
//# sourceMappingURL=orders.d.ts.map