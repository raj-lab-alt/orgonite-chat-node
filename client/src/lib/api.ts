import type { ProductData, OrderData } from "@/stores/chat-store";

const BASE = import.meta.env.VITE_API_BASE ?? "";

function getSessionKey() {
  const storageKey = "orgonite_session_key";
  try {
    let sessionKey = localStorage.getItem(storageKey);
    if (!sessionKey) {
      sessionKey = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(storageKey, sessionKey);
    }
    return sessionKey;
  } catch {
    return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export async function fetchTracking() {
  const res = await fetch(`${BASE}/api/tracking`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchProducts() {
  const res = await fetch(`${BASE}/api/products`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchServices() {
  const res = await fetch(`${BASE}/api/services`);
  if (!res.ok) return [];
  return res.json();
}

export interface SendMessageParams {
  message: string;
  imageBase64?: string;
  imageMimeType?: string;
  productId?: string | null;
  productType?: string;
  conversationMode?: string;
  history?: { role: string; text?: string; imageBase64?: string; imageMimeType?: string }[];
  orderConfirmed?: boolean;
  onChunk: (text: string) => void;
  onDone: (data: { reply: string; order?: OrderData; product?: ProductData; products?: ProductData[] }) => void;
  onError: (err: string) => void;
  signal?: AbortSignal;
}

export async function sendMessage({
  message,
  imageBase64,
  imageMimeType,
  productId,
  productType = "general",
  conversationMode = "A",
  history = [],
  orderConfirmed = false,
  onChunk,
  onDone,
  onError,
  signal,
}: SendMessageParams) {
  try {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "X-Session-Key": getSessionKey(),
      },
      body: JSON.stringify({
        message,
        imageBase64,
        imageMimeType,
        productId,
        productType,
        conversationMode,
        history,
        orderConfirmed,
        stream: true,
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erreur serveur" }));
      onError(err.error || `HTTP ${res.status}`);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError("Pas de flux disponible");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const data = JSON.parse(jsonStr);

          if (data.done) {
            onDone({
              reply: data.reply || "",
              order: data.order,
              product: data.product,
              products: data.products,
            });
          } else if (data.text) {
            onChunk(data.text);
          }
        } catch {
          // skip malformed
        }
      }
    }
  } catch (err: any) {
    if (err.name === "AbortError") return;
    onError(err.message || "Erreur de connexion");
  }
}

export async function sendVoiceMessage(params: {
  audioBlob: Blob;
  message?: string;
  productId?: string | null;
  productType?: string;
  conversationMode?: string;
  history?: string;
  onChunk: (text: string) => void;
  onDone: (data: { reply: string; order?: OrderData; product?: ProductData; products?: ProductData[] }) => void;
  onError: (err: string) => void;
}) {
  try {
    const formData = new FormData();
    formData.append("audio", params.audioBlob, "voice.webm");
    formData.append("message", params.message || "");
    if (params.productId) formData.append("productId", params.productId);
    if (params.productType) formData.append("productType", params.productType);
    if (params.conversationMode) formData.append("conversationMode", params.conversationMode);
    if (params.history) formData.append("history", params.history);

    const res = await fetch(`${BASE}/api/chat/voice?stream=1`, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "X-Session-Key": getSessionKey(),
      },
      body: formData,
    });

    if (!res.ok) {
      params.onError("Erreur envoi vocal");
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      params.onError("Erreur lecture flux vocal");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const data = JSON.parse(jsonStr);
          if (data.done) {
            params.onDone({
              reply: data.reply || "",
              order: data.order,
              product: data.product,
              products: data.products,
            });
          } else if (data.text) {
            params.onChunk(data.text);
          }
        } catch {}
      }
    }
  } catch (err: any) {
    params.onError(err.message || "Erreur vocale");
  }
}
