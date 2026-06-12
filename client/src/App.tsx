import { useEffect } from "react";
import { Routes, Route, useParams, Navigate } from "react-router-dom";
import { useChatStore } from "@/stores/chat-store";
import { fetchProducts } from "@/lib/api";
import ChatPage from "@/pages/Chat/ChatPage";

// Map URL slugs to product IDs and types
const PRODUCT_ROUTES: Record<string, { id: string; type: string; mode: "B" | "C" }> = {
  "coeur-vert-protection": { id: "coeur_vert_protection", type: "protection", mode: "B" },
  "coeur-amethyste": { id: "coeur_amethyste", type: "spiritual", mode: "B" },
  "coeur-rose-amour": { id: "coeur_rose_amour", type: "love", mode: "B" },
  "cone-voiture": { id: "cone_voiture", type: "protection", mode: "B" },
  "dome-abondance": { id: "dome_abondance", type: "abundance", mode: "B" },
  "anti-ondes": { id: "orgonite_anti_ondes", type: "protection", mode: "B" },
  "islamique": { id: "orgonite_islamique", type: "islamic", mode: "B" },
  "orgondisc-recharge": { id: "orgonedisc_recharge", type: "accessory", mode: "B" },
  "personnalisee": { id: "orgonite_perso", type: "custom", mode: "C" },
};

function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const route = slug ? PRODUCT_ROUTES[slug] : null;
  const setProduct = useChatStore((s) => s.setProduct);
  const setMode = useChatStore((s) => s.setMode);
  const reset = useChatStore((s) => s.reset);

  useEffect(() => {
    if (route) {
      setProduct(route.id, route.type as any);
      setMode(route.mode);
    }
  }, [slug]);

  if (!route) return <Navigate to="/" replace />;

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
      <Route path="/admin/*" element={<Navigate to="/admin" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
