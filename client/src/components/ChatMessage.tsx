import { cn } from "@/lib/utils";
import type { ProductData, OrderData } from "@/stores/chat-store";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  trustedHtml?: boolean;
  imageBase64?: string;
  imageMimeType?: string;
  product?: ProductData;
  products?: ProductData[];
  order?: OrderData;
  onOrderProduct?: (productName: string) => void;
}

function MiniProductCard({ product, onOrder }: { product: ProductData; onOrder?: (name: string) => void }) {
  const imageUrl = getProductImage(product);
  const name = product.name || "Produit";
  const price = product.price ?? product.prix ?? "";
  const currency = product.currency || "DT";

  return (
    <div className="inline-flex items-stretch gap-0 rounded-lg border border-primary/15 overflow-hidden bg-card max-w-[300px]">
      {imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          className="w-24 h-24 shrink-0 object-cover aspect-square"
        />
      )}
      <div className="flex flex-col justify-between p-3 min-w-0 flex-1">
        <p className="font-medium text-sm truncate leading-snug">{name}</p>
        {price !== "" && (
          <p className="text-sm font-bold text-primary leading-snug">
            {price} {currency}
          </p>
        )}
        {onOrder && (
          <button
            onClick={(e) => { e.stopPropagation(); onOrder(name); }}
            className="self-start mt-1.5 text-[11px] font-medium leading-tight bg-primary text-primary-foreground rounded-md px-2 py-1 hover:bg-primary/90 transition-colors"
          >
            Commander
          </button>
        )}
      </div>
    </div>
  );
}

export function ChatMessageBubble({
  role,
  content,
  isStreaming,
  trustedHtml,
  imageBase64,
  imageMimeType,
  product,
  products,
  order,
  onOrderProduct,
}: ChatMessageProps) {
  const isUser = role === "user";
  const displayContent = cleanMessageContent(content, trustedHtml);
  const productCards = uniqueProducts(product, products);

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
        {trustedHtml ? (
          <div className="text-sm leading-relaxed [&_iframe]:max-w-full [&_iframe]:rounded-lg [&_iframe]:mb-3 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold" dangerouslySetInnerHTML={{ __html: displayContent }} />
        ) : (
          <p className="whitespace-pre-wrap break-words">{displayContent}</p>
        )}

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
            {productCards.map((p: ProductData) => (
              <MiniProductCard key={p.id} product={p} onOrder={onOrderProduct} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function cleanMessageContent(content: string, trustedHtml?: boolean) {
  let cleaned = content.replace(/\[RENDER_PRODUCT:\s*[a-zA-Z0-9_]+\]/g, "");
  if (!trustedHtml) {
    cleaned = cleaned.replace(/<[^>]*>/g, "");
  }
  return cleaned.trim();
}

function uniqueProducts(product?: ProductData, products?: ProductData[]) {
  const list = [product, ...(products || [])].filter(Boolean) as ProductData[];
  const seen = new Set<string>();

  return list.filter((item) => {
    const key = String(item.id || item.slug || item.name || JSON.stringify(item));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getProductImage(product: ProductData) {
  if (product.imageUrl) return product.imageUrl;
  if (product.image_url) return product.image_url;
  if (Array.isArray(product.images) && product.images.length > 0) return product.images[0];
  return "";
}
