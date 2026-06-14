import { useEffect } from "react";
import { Routes, Route, useSearchParams, Navigate, useNavigate } from "react-router-dom";
import { useChatStore } from "@/stores/chat-store";
import type { ProductData } from "@/stores/chat-store";
import type { ProductType } from "@/stores/chat-store";
import { fetchProducts } from "@/lib/api";
import ChatPage from "@/pages/Chat/ChatPage";
import AdminPage from "@/pages/Admin/AdminPage";

function HomePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setProduct = useChatStore((s) => s.setProduct);
  const setMode = useChatStore((s) => s.setMode);
  const slug = searchParams.get("slug");

  useEffect(() => {
    if (slug) {
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
    } else {
      setProduct(null, "general");
      setMode("A");
    }
  }, [slug]);

  return <ChatPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
