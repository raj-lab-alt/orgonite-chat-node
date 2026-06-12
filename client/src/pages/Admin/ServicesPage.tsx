import { useEffect, useState } from "react";
import { getAdminServices, createService, updateService, deleteService } from "@/lib/admin-api";
import { fetchProducts } from "@/lib/api";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: string;
  visible: boolean;
  imageUrl?: string;
  productIds?: string[];
  description?: string;
}

const EMPTY_FORM = {
  id: "", name: "", slug: "", subtitle: "", price: 0, icon: "🔮",
  imageUrl: "", color: "#8b5cf6", description: "", benefits: "",
  duration: "", format: "", visible: true, productIds: [],
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([getAdminServices(), fetchProducts()]);
      setServices(s || []);
      setProducts(p || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async () => {
    if (editing) {
      await updateService(editing, form);
    } else {
      await createService(form);
    }
    setShowForm(false); setEditing(null); setForm(EMPTY_FORM);
    loadData();
  };

  const handleEdit = (s: any) => {
    setForm({
      id: s.id, name: s.name, slug: s.slug || s.id.replace(/_/g, "-"),
      subtitle: s.subtitle || "", price: s.price, icon: s.icon || "🔮",
      imageUrl: s.imageUrl || "", color: s.color || "#8b5cf6",
      description: s.description || "", benefits: s.benefits || "",
      duration: s.duration || "", format: s.format || "",
      visible: s.visible !== false, productIds: s.productIds || [],
    });
    setEditing(s.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce service ?")) return;
    await deleteService(id);
    loadData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Services</h1>
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditing(null); setShowForm(true); }}
          className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm"
        >
          + Nouveau
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10">
          <div className="bg-background rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h2 className="font-semibold mb-4">{editing ? "Modifier" : "Nouveau"} service</h2>
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
                  <label className="block text-xs mb-1">Duree</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1">Description</label>
                <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs mb-1">Benefices</label>
                <textarea className="w-full border rounded px-2 py-1.5 text-sm" rows={3} value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs mb-1">Produits lies</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {products.map((p: any) => (
                    <label key={p.id} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={form.productIds.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) setForm({ ...form, productIds: [...form.productIds, p.id] });
                          else setForm({ ...form, productIds: form.productIds.filter((id: string) => id !== p.id) });
                        }}
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />
                Visible
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-md border text-sm">Annuler</button>
              <button onClick={handleSave} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm">
                {editing ? "Modifier" : "Creer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid gap-3">
          {services.map((s) => (
            <div key={s.id} className="rounded-xl border bg-card p-4 flex items-center gap-4">
              {s.imageUrl && <img src={s.imageUrl} alt={s.name} className="w-12 h-12 rounded object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.id} · {s.price} DT · {s.duration} · {s.visible ? "Visible" : "Cache"}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleEdit(s)} className="text-xs text-primary hover:underline">Modifier</button>
                <button onClick={() => handleDelete(s.id)} className="text-xs text-destructive hover:underline">Suppr.</button>
              </div>
            </div>
          ))}
          {services.length === 0 && <p className="text-center text-muted-foreground py-10">Aucun service</p>}
        </div>
      )}
    </div>
  );
}
