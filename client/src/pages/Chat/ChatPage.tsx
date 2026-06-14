import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const view = searchParams.get("view") || "chat";

  const [showAudio, setShowAudio] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [welcomeProduct, setWelcomeProduct] = useState<any>(null);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const [error, setError] = useState("");
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
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
        setAllProducts(products);
        const p = products.find((p: any) => p.id === productId || p.slug === productId);
        if (p) setWelcomeProduct(p);
      });
    }
    fetchProducts().then(setAllProducts);
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

  const showPageView = view === "product" || view === "service";

  return (
    <div className="chat-container flex flex-col h-dvh bg-background">
      {/* SPA Navigation */}
      <nav className={`shrink-0 bg-background border-b border-primary/10 px-4 py-3 flex items-center gap-3 ${showPageView ? "" : "hidden"}`}>
        <button
          onClick={() => navigate("/")}
          className="bg-muted border border-primary/15 text-foreground px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 hover:bg-muted/80 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Retour
        </button>
        <span className="text-sm font-semibold text-foreground truncate">
          {view === "product" ? (welcomeProduct?.name || "Produit") : view === "service" ? "Services" : ""}
        </span>
      </nav>

      {/* Header */}
      <header className="shrink-0 bg-background/92 border-b border-primary/10 px-4 py-3 flex items-center gap-3 backdrop-blur-xl">
        <div className="relative shrink-0">
          <div className="w-[46px] h-[46px] rounded-full p-[2px]" style={{
            background: "conic-gradient(from 0deg, rgba(140,110,255,0.5), rgba(99,102,241,0.15), rgba(180,140,255,0.4), rgba(140,110,255,0.5))",
            animation: "avatarSpin 4s linear infinite",
          }}>
            <img
              src="/amine-avatar.webp"
              alt="Amine"
              className="w-full h-full rounded-full object-cover"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                (el.parentNode as HTMLElement).style.background = "linear-gradient(135deg, #7c3aed, #6366f1)";
              }}
            />
          </div>
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-background animate-status-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-semibold text-foreground truncate">Amine</h1>
            <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ filter: "drop-shadow(0 0 6px rgba(59,130,246,0.6))" }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground/60 tracking-wider uppercase">Conseiller Énergétique</p>
        </div>
      </header>

      {/* Trust Bar */}
      <div className="shrink-0 flex justify-center items-center gap-3 px-2.5 py-1.5 bg-[#0c0c16]/70 border-b border-primary/5 flex-wrap text-center">
        <span className="text-[10.5px] text-muted-foreground/70">⭐⭐⭐⭐⭐ 4.9/5 — 1 247 avis vérifiés</span>
        <span className="text-[10.5px] text-muted-foreground/70">🇹🇳 Livraison dans toute la Tunisie</span>
        <span className="text-[10.5px] text-muted-foreground/70">💳 Paiement à la livraison</span>
      </div>

      {/* Page View (product details, services) */}
      {showPageView && (
        <div className="flex-1 overflow-y-auto">
          {view === "product" && (
            <div className="p-4">
              {welcomeProduct ? (
                <div className="bg-card border border-primary/10 rounded-2xl overflow-hidden product-card">
                  {(welcomeProduct.imageUrl || welcomeProduct.image_url) && (
                    <img
                      src={welcomeProduct.imageUrl || welcomeProduct.image_url}
                      alt={welcomeProduct.name || "Produit"}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h2 className="text-lg font-bold text-foreground">{welcomeProduct.name || "Produit"}</h2>
                    {(welcomeProduct.price || welcomeProduct.prix) && (
                      <p className="text-xl font-bold text-primary mt-1">
                        {welcomeProduct.price || welcomeProduct.prix} {welcomeProduct.currency || "DT"}
                      </p>
                    )}
                    {welcomeProduct.description && (
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{welcomeProduct.description}</p>
                    )}
                    <button
                      onClick={() => navigate("/")}
                      className="w-full mt-4 bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:bg-primary/90 transition-colors"
                    >
                      Discuter de ce produit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Chargement...</div>
              )}
            </div>
          )}
          {view === "service" && (
            <div className="p-4">
              <p className="text-sm text-muted-foreground">Page service à configurer</p>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {!showPageView && (
        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {messages.length === 0 && !welcomeMsg && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <div className="w-[68px] h-[68px] rounded-full p-[3px] mb-4" style={{
                background: "conic-gradient(from 0deg, rgba(140,110,255,0.5), rgba(99,102,241,0.15), rgba(180,140,255,0.4), rgba(140,110,255,0.5))",
                animation: "avatarSpin 4s linear infinite",
              }}>
                <img
                  src="/amine-avatar.webp"
                  alt="Amine"
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    el.style.display = "none";
                    (el.parentNode as HTMLElement).style.background = "linear-gradient(135deg, #7c3aed, #6366f1)";
                  }}
                />
              </div>
              <p className="text-sm max-w-xs text-muted-foreground">
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
      )}

      {/* Audio recorder */}
      {showAudio && (
        <AudioRecorder
          onRecorded={handleVoiceRecorded}
          onClose={() => setShowAudio(false)}
        />
      )}

      {/* Input */}
      {!showPageView && (
        <ChatInput
          onSend={handleSend}
          onStartVoice={() => setShowAudio(true)}
          isStreaming={isStreaming}
        />
      )}
    </div>
  );
}
