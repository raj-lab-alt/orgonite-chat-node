import { useEffect, useState } from "react";
import { Routes, Route, useParams, Navigate } from "react-router-dom";
import type { ProductData } from "@/stores/chat-store";
import { useChatStore } from "@/stores/chat-store";
import type { ProductType } from "@/stores/chat-store";
import { fetchProducts } from "@/lib/api";
import ChatPage from "@/pages/Chat/ChatPage";
import AdminPage from "@/pages/Admin/AdminPage";

function productMode(productType: string): "B" | "C" {
  return productType === "custom" ? "C" : "B";
}

function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [found, setFound] = useState(false);
  const setProduct = useChatStore((s) => s.setProduct);
  const setMode = useChatStore((s) => s.setMode);

  useEffect(() => {
    setLoading(true);
    setFound(false);
    fetchProducts().then((products: ProductData[]) => {
      const p = products.find((p) => p.slug === slug);
      if (p) {
        const type = (p.productType || "general") as ProductType;
        setProduct(p.id, type);
        setMode(productMode(type));
        setFound(true);
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) return null;
  if (!found) return <Navigate to="/" replace />;

  return <ChatPage key={slug} />;
}

function HomePage() {
  const setProduct = useChatStore((s) => s.setProduct);
  const setMode = useChatStore((s) => s.setMode);

  useEffect(() => {
    setProduct(null, "general");
    setMode("A");
  }, []);

  return <ChatPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/produit/:slug" element={<ProductPage />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
