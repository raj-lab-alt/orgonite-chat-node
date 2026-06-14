import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useChatStore } from "@/stores/chat-store";
import type { ProductData, ProductType } from "@/stores/chat-store";
import { fetchProducts } from "@/lib/api";
import ChatPage from "./ChatPage";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const setProduct = useChatStore((s) => s.setProduct);
  const setMode = useChatStore((s) => s.setMode);
  const [product, setLocalProduct] = useState<ProductData | null | false>(null);

  useEffect(() => {
    if (!slug) return;
    fetchProducts().then((products: ProductData[]) => {
      const p = products.find((prod) => prod.slug === slug);
      if (p) {
        setLocalProduct(p);
        const type = (p.productType || "general") as ProductType;
        setProduct(p.id, type);
        setMode(type === "custom" ? "C" : "B");
      } else {
        setLocalProduct(false);
      }
    });
  }, [slug]);

  if (product === null) {
    return (
      <div className="chat-container flex items-center justify-center h-dvh bg-background">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (product === false) {
    return <Navigate to="/" replace />;
  }

  return <ChatPage showProductHero product={product} />;
}
