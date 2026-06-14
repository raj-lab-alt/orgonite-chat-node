import { useEffect, useState, useRef } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAdminStore } from "@/stores/admin-store";
import { useAdminWs } from "@/hooks/useAdminWs";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";
import OrdersPage from "./OrdersPage";
import ProductsPage from "./ProductsPage";
import ServicesPage from "./ServicesPage";
import ConfigPage from "./ConfigPage";

const NAV_ITEMS = [
  { path: "/admin", label: "Dashboard", icon: "📊" },
  { path: "/admin/orders", label: "Commandes", icon: "📦" },
  { path: "/admin/products", label: "Produits", icon: "🏷️" },
  { path: "/admin/services", label: "Services", icon: "🔮" },
  { path: "/admin/config", label: "Configuration", icon: "⚙️" },
  { path: "/", label: "Retour au chat", icon: "💬" },
];

export default function AdminPage() {
  const { isAuth, checking, checkAuth, logout } = useAdminStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [newOrderCount, setNewOrderCount] = useState(0);

  const [toast, setToast] = useState<{ id: number; nom: string; produit?: string } | null>(null);
  const toastIdRef = useRef(0);

  useAdminWs((ev) => {
    if (ev.event === "new_order") {
      const data = ev.data as any;
      setNewOrderCount((c) => c + 1);
      const id = ++toastIdRef.current;
      setToast({ id, nom: data?.nom || "Commande", produit: data?.produit });
      setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 4000);
    }
  });

  useEffect(() => {
    checkAuth();
  }, []);

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuth) {
    return <LoginPage />;
  }

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-dvh flex">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-card shrink-0 hidden md:flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
              O
            </div>
            <div>
              <p className="text-sm font-semibold">Orgonite Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                if (item.path === "/admin/orders") setNewOrderCount(0);
                navigate(item.path);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                isActive(item.path)
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.path === "/admin/orders" && newOrderCount > 0 && (
                <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                  {newOrderCount > 99 ? "99+" : newOrderCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t">
          <button
            onClick={() => { logout(); navigate("/admin"); }}
            className="w-full text-sm text-muted-foreground hover:text-destructive text-left px-3 py-2"
          >
            Deconnexion
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b px-4 py-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
          O
        </div>
        <div className="flex-1 text-sm font-semibold">Orgonite Admin</div>
        <select
          onChange={(e) => {
            if (e.target.value === "/admin/orders") setNewOrderCount(0);
            navigate(e.target.value);
          }}
          value={location.pathname}
          className="text-sm border rounded px-2 py-1"
        >
          {NAV_ITEMS.map((item) => (
            <option key={item.path} value={item.path}>
              {item.icon} {item.label}
              {item.path === "/admin/orders" && newOrderCount > 0 ? ` (${newOrderCount})` : ""}
            </option>
          ))}
        </select>
        <button onClick={logout} className="text-xs text-muted-foreground">
          Exit
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-14">
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </main>
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-right-4 fade-in max-w-sm bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-start gap-3">
          <span className="text-lg mt-0.5">📦</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{toast.nom}</p>
            {toast.produit && <p className="text-xs opacity-80 truncate">{toast.produit}</p>}
          </div>
          <button
            onClick={() => { setToast(null); navigate("/admin/orders"); setNewOrderCount(0); }}
            className="shrink-0 text-xs underline underline-offset-2 hover:no-underline"
          >
            Voir
          </button>
        </div>
      )}
    </div>
  );
}
