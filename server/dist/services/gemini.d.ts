interface GeminiContent {
    role: "user" | "model";
    parts: {
        text?: string;
        inline_data?: {
            data: string;
            mime_type: string;
        };
    }[];
}
interface ChatMessage {
    role: string;
    text?: string;
    imageBase64?: string;
    imageMimeType?: string;
    audioBase64?: string;
    audioMimeType?: string;
}
export declare function buildContents(messages: ChatMessage[]): GeminiContent[];
export declare function callGemini(apiKey: string, model: string, contents: GeminiContent[], systemPrompt: string): Promise<string>;
export declare class GeminiError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number);
}
export declare function chatGeminiRequestStream(message: string, extraFields: {
    imageBase64?: string | null;
    imageMimeType?: string | null;
    audioBase64?: string | null;
    audioMimeType?: string | null;
}, history: ChatMessage[], productId: string | null, conversationMode: string, isVoice: boolean, productType: string, systemPrompt: string, apiKeys: string[], models: string[]): AsyncGenerator<string>;
export {};
//# sourceMappingURL=gemini.d.ts.map