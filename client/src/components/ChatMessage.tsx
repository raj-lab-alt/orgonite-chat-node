import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  product?: any;
  products?: any[];
  order?: any;
}

export function ChatMessageBubble({
  role,
  content,
  isStreaming,
  product,
  products,
  order,
}: ChatMessageProps) {
  const isUser = role === "user";
  const [displayed, setDisplayed] = useState(isUser ? content : "");
  const indexRef = useRef(0);

  useEffect(() => {
    if (isUser) {
      setDisplayed(content);
      return;
    }

    indexRef.current = 0;
    setDisplayed("");

    if (!content) return;

    const interval = setInterval(() => {
      indexRef.current++;
      setDisplayed(content.slice(0, indexRef.current));

      if (indexRef.current >= content.length) {
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [content, isUser]);

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

        {order && (
          <div className="mt-2 p-2 rounded-lg bg-primary/10 text-xs">
            <p className="font-semibold">Commande #{order.id}</p>
            <p>Produit: {order.produit}</p>
            <p>Total: {order.totalCommande} DT</p>
            <p>Statut: {order.statut}</p>
          </div>
        )}

        {product && <ProductCardBrief product={product} />}
        {products && products.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {products.map((p: any) => (
              <ProductCardBrief key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCardBrief({ product }: { product: any }) {
  return (
    <div className="mt-2 p-2 rounded-lg bg-card border text-xs">
      <div className="flex gap-2 items-start">
        {product.imageUrl && (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-12 h-12 rounded object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{product.name}</p>
          <p className="text-muted-foreground">
            {product.price} {product.currency}
          </p>
        </div>
      </div>
    </div>
  );
}
