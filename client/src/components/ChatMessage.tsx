import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  imageBase64?: string;
  imageMimeType?: string;
  product?: any;
  products?: any[];
  order?: any;
  onOrderProduct?: (productName: string) => void;
}

export function ChatMessageBubble({
  role,
  content,
  isStreaming,
  imageBase64,
  imageMimeType,
  product,
  products,
  order,
  onOrderProduct,
}: ChatMessageProps) {
  const isUser = role === "user";
  const displayContent = cleanMessageContent(content);
  const [displayed, setDisplayed] = useState(isUser ? displayContent : "");
  const indexRef = useRef(0);
  const productCards = uniqueProducts(product, products);

  useEffect(() => {
    if (isUser) {
      setDisplayed(displayContent);
      return;
    }

    indexRef.current = 0;
    setDisplayed("");

    if (!displayContent) return;

    const interval = setInterval(() => {
      indexRef.current++;
      setDisplayed(displayContent.slice(0, indexRef.current));

      if (indexRef.current >= displayContent.length) {
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [displayContent, isUser]);

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}
      >
        <p className="whitespace-pre-wrap break-words">
          {displayed}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse" />
          )}
        </p>

        {imageBase64 && imageMimeType && (
          <img
            src={`data:${imageMimeType};base64,${imageBase64}`}
            alt="Image jointe"
            className="mt-2 max-h-64 w-full rounded-lg border object-contain bg-background"
          />
        )}

        {order && (
          <div className="mt-2 p-2 rounded-lg bg-primary/10 text-xs">
            <p className="font-semibold">Commande #{order.id}</p>
            <p>Produit: {order.produit}</p>
            <p>Total: {order.totalCommande} DT</p>
            <p>Statut: {order.statut}</p>
          </div>
        )}

        {productCards.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {productCards.map((p: any) => (
              <MiniProductCard key={p.id} product={p} onOrder={onOrderProduct} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniProductCard({ product, onOrder }: { product: any; onOrder?: (name: string) => void }) {
  const imageUrl = getProductImage(product);
  const name = product.name || "Produit";
  const price = product.price ?? product.prix ?? "";
  const currency = product.currency || "DT";

  return (
    <div className="inline-flex items-stretch gap-0 rounded-lg border bg-card overflow-hidden max-w-[220px]">
      {imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          className="w-14 h-14 shrink-0 object-cover"
        />
      )}
      <div className="flex flex-col justify-between py-1.5 px-2 min-w-0 flex-1">
        <p className="font-medium text-xs truncate leading-tight">{name}</p>
        {price !== "" && (
          <p className="text-xs font-semibold leading-tight">
            {price} {currency}
          </p>
        )}
        {onOrder && (
          <button
            onClick={(e) => { e.stopPropagation(); onOrder(name); }}
            className="self-start mt-1 text-[10px] leading-tight bg-primary text-primary-foreground rounded px-1.5 py-0.5 hover:bg-primary/90 transition-colors"
          >
            Commander
          </button>
        )}
      </div>
    </div>
  );
}

function cleanMessageContent(content: string) {
  return content
    .replace(/\[RENDER_PRODUCT:\s*[a-zA-Z0-9_]+\]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function uniqueProducts(product?: any, products?: any[]) {
  const list = [product, ...(products || [])].filter(Boolean);
  const seen = new Set<string>();

  return list.filter((item: any) => {
    const key = String(item.id || item.slug || item.name || JSON.stringify(item));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getProductImage(product: any) {
  if (product.imageUrl) return product.imageUrl;
  if (product.image_url) return product.image_url;
  if (Array.isArray(product.images) && product.images.length > 0) return product.images[0];
  return "";
}
