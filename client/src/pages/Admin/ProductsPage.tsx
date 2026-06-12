import { useEffect, useState } from "react";
import {
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  syncProducts,
  getConfig,
} from "@/lib/admin-api";

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  productType: string;
  visible: boolean;
  imageUrl?: string;
  benefits?: string;
  stock?: number;
}

const EMPTY_FORM = {
  id: "",
  name: "",
  slug: "",
  price: 0,
  currency: "DT",
  imageUrl: "",
  benefits: "",
  productType: "general",
  visible: true,
  stock: 10,
  taille: "",
  accentColor: "#7c3aed",
  hook: "",
  hookTransition: "",
  upsellPrice: null,
  priceOriginal: null,
  welcomeSequence: [],
  faq: [],
  reviews: [],
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getAdminProducts();
      setProducts(data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSave = async () => {
    if (editing) {
      await updateProduct(editing, form);
    } else {
      await createProduct(form);
    }
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    loadProducts();
  };

  const handleEdit = (p: any) => {
    setForm({
      id: p.id,
      name: p.name,
      slug: p.slug || p.id?.replace(/_/g, "-"),
      price: p.price,
      currency: p.currency || "DT",
      imageUrl: p.imageUrl || "",
      benefits: p.benefits || "",
      productType: p.productType || "general",
      visible: p.visible !== false,
      stock: p.stock || 10,
      taille: p.taille || "",
      accentColor: p.accentColor || "#7c3aed",
      hook: p.hook || "",
      hookTransition: p.hookTransition || "",
      upsellPrice: p.upsellPrice || null,
      priceOriginal: p.priceOriginal || null,
      welcomeSequence: p.welcomeSequence || [],
      faq: p.faq || [],
      reviews: p.reviews || [],
    });
    setEditing(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce produit ?")) return;
    await deleteProduct(id);
    loadProducts();
  };

  const handleSync = async () => {
    try {
      const config = await getConfig();
      if (config.products?.length) {
        await syncProducts(config.products);
        loadProducts();
      }
    } catch {}
  };

  const productTypes = ["general", "protection", "spiritual", "love", "abundance", "islamic", "accessory", "custom"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Produits</h1>
        <div className="flex gap-2">
          <button onClick={handleSync} className="px-3 py-1.5 rounded-md border text-sm hover:bg-muted">
            Sync config
          </button>
          <button
            onClick={() => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true); }}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
          >
            + Nouveau
          </button>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10">
          <div className="bg-background rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h2 className="font-semibold mb-4">{editing ? "Modifier" : "Nouveau"} produit</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1">ID</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} disabled={!!editing} />
                </div>
                <div>
                  <label className="block text-xs mb-1">Name</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1">Prix</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs mb-1">Devise</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1">Type</label>
                <select className="w-full border rounded px-2 py-1.5 text-sm" value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })}>
                  {productTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Image URL</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs mb-1">Benefices</label>
                <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={3} value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1">Stock</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs mb-1">Taille</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.taille} onChange={(e) => setForm({ ...form, taille: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />
                Visible
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-md border text-sm">
                Annuler
              </button>
              <button onClick={handleSave} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm">
                {editing ? "Modifier" : "Creer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product list */}
      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid gap-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-xl border bg-card p-4 flex items-center gap-4">
              {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.id} · {p.price} {p.currency} · {p.productType} · {p.visible ? "Visible" : "Cache"}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleEdit(p)} className="text-xs text-primary hover:underline">Modifier</button>
                <button onClick={() => handleDelete(p.id)} className="text-xs text-destructive hover:underline">Suppr.</button>
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="text-center text-muted-foreground py-10">Aucun produit</p>}
        </div>
      )}
    </div>
  );
}
