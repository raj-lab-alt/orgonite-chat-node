import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  imageBase64?: string;
  imageMimeType?: string;
  product?: any;
  products?: any[];
  order?: any;
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
