import { useEffect } from "react";
import { Routes, Route, useSearchParams, Navigate, useNavigate } from "react-router-dom";
import { useChatStore } from "@/stores/chat-store";
import type { ProductData } from "@/stores/chat-store";
import type { ProductType } from "@/stores/chat-store";
import { fetchProducts } from "@/lib/api";
import ChatPage from "@/pages/Chat/ChatPage";
import AdminPage from "@/pages/Admin/AdminPage";
import ProductPage from "@/pages/Chat/ProductPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function HomePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setProduct = useChatStore((s) => s.setProduct);
  const setMode = useChatStore((s) => s.setMode);
  const slug = searchParams.get("slug");
  const product = searchParams.get("product");
  const view = searchParams.get("view") || "chat";

  useEffect(() => {
    if (product) {
      navigate(`/?slug=${encodeURIComponent(product)}&view=product`, { replace: true });
      return;
    }
    if (slug && view !== "product") {
      navigate(`/?slug=${encodeURIComponent(slug)}&view=product`, { replace: true });
      return;
    }
    if (slug && view === "product") {
      fetchProducts().then((products: ProductData[]) => {
        const p = products.find((prod) => prod.slug === slug);
        if (p) {
          const type = (p.productType || "general") as ProductType;
          setProduct(p.id, type);
          setMode(type === "custom" ? "C" : "B");
        } else {
          navigate("/", { replace: true });
        }
      });
      return;
    }
    setProduct(null, "general");
    setMode("A");
  }, [slug, product, view]);

  return <ChatPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/orgonite/:slug" element={<ProductPage />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
