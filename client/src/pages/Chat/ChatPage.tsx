import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import { ChatMessageBubble } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { AudioRecorder } from "@/components/AudioRecorder";
import { sendMessage, sendVoiceMessage, fetchTracking, fetchProducts } from "@/lib/api";
import type { ChatMessage } from "@/stores/chat-store";

let msgIdCounter = 0;
function nextId() {
  return `msg_${Date.now()}_${++msgIdCounter}`;
}

function collectRenderedProductIds(messages: ChatMessage[]) {
  const ids = new Set<string>();

  for (const msg of messages) {
    const productList = [msg.product, ...(msg.products || [])].filter(Boolean);
    for (const product of productList) {
      if (product?.id) ids.add(String(product.id));
    }
  }

  return [...ids];
}

export default function ChatPage() {
  const {
    messages, isStreaming, streamingContent, mode, productId, productType,
    orderConfirmed, history, addMessage, setStreaming, appendStream,
    clearStream, setOrderConfirmed,
  } = useChatStore();

  const [showAudio, setShowAudio] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [welcomeProduct, setWelcomeProduct] = useState<any>(null);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const welcomeShown = useRef(false);

  useEffect(() => {
    fetchTracking().then((data) => {
      if (data?.welcomeMessage) {
        setWelcomeMsg(data.welcomeMessage);
        setWelcomeDone(true);
      }
    });
    if (productId) {
      fetchProducts().then((products) => {
        const p = products.find((p: any) => p.id === productId || p.slug === productId);
        if (p) setWelcomeProduct(p);
      });
    }
  }, [productId]);

  useEffect(() => {
    if (welcomeDone && !welcomeShown.current && messages.length === 0) {
      welcomeShown.current = true;
      addMessage({
        id: `welcome_${Date.now()}`,
        role: "assistant",
        content: welcomeMsg,
        timestamp: Date.now(),
        product: welcomeProduct || undefined,
        trustedHtml: true,
      });
    }
  }, [welcomeDone, welcomeProduct]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const streamingRef = useRef(streamingContent);
  streamingRef.current = streamingContent;

  const handleSend = useCallback(
    (text: string, imageBase64?: string, imageMimeType?: string) => {
      setError("");

      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        content: text || "(image)",
        timestamp: Date.now(),
        imageBase64,
        imageMimeType,
      };
      addMessage(userMsg);

      // If assistant hasn't spoken yet + mode A, use welcome message
      const currentMessages = useChatStore.getState().messages;
      const renderedProductIds = collectRenderedProductIds(currentMessages);
      const msgCount = currentMessages.filter((m) => m.role === "assistant").length;
      const currentMode = useChatStore.getState().mode;

      if (currentMode === "A" && msgCount === 0 && welcomeMsg) {
        const assistantMsg: ChatMessage = {
          id: nextId(),
          role: "assistant",
          content: welcomeMsg
            .replace(/\[RENDER_PRODUCT:\s*[a-zA-Z0-9_]+\]/g, "")
            .replace(/<[^>]*>/g, ""),
          timestamp: Date.now(),
          product: welcomeProduct,
        };
        addMessage(assistantMsg);
      }

      // Abort previous in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      setStreaming(true);
      clearStream();
      const controller = new AbortController();
      abortRef.current = controller;

      sendMessage({
        message: text,
        imageBase64,
        imageMimeType,
        productId,
        productType,
        conversationMode: mode,
        history,
        renderedProductIds,
        orderConfirmed,
        signal: controller.signal,
        onChunk: (chunk) => {
          appendStream(chunk);
        },
        onDone: (data) => {
          const assistantMsg: ChatMessage = {
            id: nextId(),
            role: "assistant",
            content: data.reply || streamingRef.current,
            timestamp: Date.now(),
            product: data.product,
            products: data.products,
            order: data.order,
          };
          addMessage(assistantMsg);
          clearStream();
          setStreaming(false);
          if (data.order) {
            setOrderConfirmed(true);
          }
        },
        onError: (err) => {
          setError(err);
          setStreaming(false);
          clearStream();
        },
      });
    },
    [mode, productId, productType, history, orderConfirmed, welcomeMsg, welcomeProduct, addMessage, setStreaming, appendStream, clearStream, setOrderConfirmed]
  );

  const handleOrderProduct = useCallback(
    (productName: string) => {
      handleSend(`Je veux commander ${productName}`);
    },
    [handleSend]
  );

  const handleVoiceRecorded = useCallback(
    (blob: Blob) => {
      setShowAudio(false);
      setError("");

      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        content: "(message vocal)",
        timestamp: Date.now(),
      };
      addMessage(userMsg);

      if (abortRef.current) {
        abortRef.current.abort();
      }

      setStreaming(true);
      clearStream();
      const renderedProductIds = collectRenderedProductIds(useChatStore.getState().messages);

      sendVoiceMessage({
        audioBlob: blob,
        message: "",
        productId,
        productType,
        conversationMode: mode,
        history: JSON.stringify(history),
        renderedProductIds,
        onChunk: (chunk) => appendStream(chunk),
        onDone: (data) => {
          const assistantMsg: ChatMessage = {
            id: nextId(),
            role: "assistant",
            content: data.reply || streamingRef.current,
            timestamp: Date.now(),
            product: data.product,
            products: data.products,
            order: data.order,
          };
          addMessage(assistantMsg);
          clearStream();
          setStreaming(false);
        },
        onError: (err) => {
          setError(err);
          setStreaming(false);
          clearStream();
        },
      });
    },
    [mode, productId, productType, history, addMessage, setStreaming, appendStream, clearStream]
  );

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
          O
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">Orgonite Tunisie</h1>
          <p className="text-xs text-muted-foreground">
            Mode {mode}
            {productId && ` · ${productId.replace(/_/g, " ")}`}
          </p>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && !welcomeMsg && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-2xl mb-4">
              O
            </div>
            <p className="text-sm max-w-xs">
              Bienvenue ! Je suis Amine, votre conseiller Orgonite Tunisie.
              Comment puis-je vous aider aujourd'hui ?
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            trustedHtml={msg.trustedHtml}
            imageBase64={msg.imageBase64}
            imageMimeType={msg.imageMimeType}
            product={msg.product}
            products={msg.products}
            order={msg.order}
            onOrderProduct={handleOrderProduct}
          />
        ))}

        {isStreaming && streamingContent && (
          <ChatMessageBubble
            role="assistant"
            content={streamingContent}
            isStreaming
            onOrderProduct={handleOrderProduct}
          />
        )}

        {error && (
          <div className="text-center text-destructive text-xs py-2">{error}</div>
        )}

        <div ref={endRef} />
      </main>

      {/* Audio recorder */}
      {showAudio && (
        <AudioRecorder
          onRecorded={handleVoiceRecorded}
          onClose={() => setShowAudio(false)}
        />
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onStartVoice={() => setShowAudio(true)}
        isStreaming={isStreaming}
      />
    </div>
  );
}
