import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useChatStore } from "@/stores/chat-store";
import type { ProductData, ProductType } from "@/stores/chat-store";
import { fetchProducts } from "@/lib/api";
import ChatPage from "./ChatPage";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const setProduct = useChatStore((s) => s.setProduct);
  const setMode = useChatStore((s) => s.setMode);
  const done = useRef(false);

  useEffect(() => {
    if (!slug || done.current) return;
    done.current = true;
    fetchProducts().then((products: ProductData[]) => {
      const p = products.find((prod) => prod.slug === slug);
      if (p) {
        const type = (p.productType || "general") as ProductType;
        setProduct(p.id, type);
        setMode(type === "custom" ? "C" : "B");
      }
    });
  }, [slug]);

  return <ChatPage showProductHero />;
}
