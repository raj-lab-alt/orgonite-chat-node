import { create } from "zustand";

export interface ProductData {
  id: string;
  name?: string;
  slug?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  image_url?: string;
  images?: string[];
  productType?: string;
  prix?: number;
  [key: string]: unknown;
}

export interface OrderData {
  id: string;
  produit?: string;
  totalCommande?: number;
  statut?: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  imageBase64?: string;
  imageMimeType?: string;
  product?: ProductData;
  products?: ProductData[];
  order?: OrderData;
  trustedHtml?: boolean;
}

export type ConversationMode = "A" | "B" | "C";
export type ProductType = "general" | "protection" | "spiritual" | "love" | "abundance" | "islamic" | "accessory" | "custom";

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  mode: ConversationMode;
  productId: string | null;
  productType: ProductType;
  orderConfirmed: boolean;
  history: { role: string; text?: string; imageBase64?: string; imageMimeType?: string }[];

  addMessage: (msg: ChatMessage) => void;
  setStreaming: (v: boolean) => void;
  appendStream: (chunk: string) => void;
  clearStream: () => void;
  setMode: (mode: ConversationMode) => void;
  setProduct: (id: string | null, type: ProductType) => void;
  setOrderConfirmed: (v: boolean) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingContent: "",
  mode: "A",
  productId: null,
  productType: "general",
  orderConfirmed: false,
  history: [],

  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, msg],
      history: [
        ...s.history.slice(-120),
        {
          role: msg.role,
          text: msg.content,
          imageBase64: msg.imageBase64,
          imageMimeType: msg.imageMimeType,
          ...(msg.role === "user" && msg.content.startsWith("[MODE")
            ? { text: msg.content.replace(/\[MODE [ABC]\]\s*/, "") }
            : {}),
        },
      ],
    })),

  setStreaming: (v) => set({ isStreaming: v }),
  appendStream: (chunk) =>
    set((s) => ({ streamingContent: s.streamingContent + chunk })),
  clearStream: () => set({ streamingContent: "" }),

  setMode: (mode) => set({ mode }),
  setProduct: (id, type) => set({ productId: id, productType: type }),
  setOrderConfirmed: (v) => set({ orderConfirmed: v }),
  reset: () =>
    set({
      messages: [],
      history: [],
      isStreaming: false,
      streamingContent: "",
      mode: "A",
      productId: null,
      productType: "general",
      orderConfirmed: false,
    }),
}));
