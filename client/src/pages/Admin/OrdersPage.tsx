import { useEffect, useState, useCallback } from "react";
import {
  getOrders,
  updateOrderStatus,
  updateOrder,
  bulkTrashOrders,
  bulkRestoreOrders,
  bulkDeleteOrders,
} from "@/lib/admin-api";

const STATUSES = [
  "attente de confirm tel", "cde double", "a expedier", "injoignable",
  "confirmee att. env.", "livree", "echouee", "nn qualifiee", "Annulee",
];

interface Order {
  id: string;
  nom: string;
  telephone: string;
  produit: string;
  statut: string;
  totalCommande: number;
  date: string;
  trashedAt: string | null;
  notes?: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrders(showTrash);
      setOrders(data || []);
    } catch {}
    setLoading(false);
  }, [showTrash]);

  useEffect(() => {
    loadOrders();
    const handler = () => loadOrders();
    window.addEventListener("admin:new-order", handler);
    return () => window.removeEventListener("admin:new-order", handler);
  }, [loadOrders]);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    if (q && !o.nom?.toLowerCase().includes(q) && !o.telephone?.includes(q) && !o.id?.toLowerCase().includes(q)) return false;
    if (filterStatus && o.statut !== filterStatus) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((o) => o.id)));
  };

  const handleBulkTrash = async () => {
    await bulkTrashOrders([...selected]);
    setSelected(new Set());
    loadOrders();
  };

  const handleBulkRestore = async () => {
    await bulkRestoreOrders([...selected]);
    setSelected(new Set());
    loadOrders();
  };

  const handleBulkDelete = async () => {
    if (!confirm("Supprimer definitivement ces commandes ?")) return;
    await bulkDeleteOrders([...selected]);
    setSelected(new Set());
    loadOrders();
  };

  const handleStatusChange = async (id: string, statut: string) => {
    await updateOrderStatus(id, statut);
    loadOrders();
  };

  const handleSaveEdit = async (id: string, field: string, value: string) => {
    await updateOrder(id, { [field]: value });
    setEditingId(null);
    loadOrders();
  };

  const statusColor = (s: string) => {
    if (s === "livree") return "text-green-600 bg-green-50";
    if (s === "echouee" || s === "Annulee") return "text-destructive bg-destructive/10";
    if (s === "attente de confirm tel") return "text-amber-600 bg-amber-50";
    return "text-muted-foreground bg-muted";
  };

  const orderDetail = viewId ? orders.find((o) => o.id === viewId) : null;

  if (viewId && orderDetail) {
    return (
      <div className="space-y-4">
        <button onClick={() => setViewId(null)} className="text-sm text-primary hover:underline">
          &larr; Retour
        </button>
        <h2 className="text-lg font-semibold">Commande {orderDetail.id}</h2>
        <div className="rounded-xl border bg-card p-4 space-y-3 text-sm">
          {[
            ["Nom", orderDetail.nom],
            ["Telephone", orderDetail.telephone],
            ["Produit", orderDetail.produit],
            ["Total", `${orderDetail.totalCommande} DT`],
            ["Statut", orderDetail.statut],
            ["Date", new Date(orderDetail.date).toLocaleString("fr-FR")],
            ["Notes", orderDetail.notes || "-"],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-4">
              <span className="text-muted-foreground min-w-[100px]">{label}</span>
              <span className="font-medium">{value as string}</span>
            </div>
          ))}

          <div className="pt-2">
            <label className="block text-sm text-muted-foreground mb-1">Changer statut</label>
            <select
              value={orderDetail.statut}
              onChange={(e) => handleStatusChange(orderDetail.id, e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Commandes</h1>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => { setShowTrash(false); setSelected(new Set()); }}
            className={`px-3 py-1 rounded ${!showTrash ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            Actives
          </button>
          <button
            onClick={() => { setShowTrash(true); setSelected(new Set()); }}
            className={`px-3 py-1 rounded ${showTrash ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            Corbeille
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher nom, tel, ID..."
          className="flex-1 min-w-[200px] rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{selected.size} selectionnee(s)</span>
          {showTrash ? (
            <>
              <button onClick={handleBulkRestore} className="px-3 py-1 rounded bg-primary/10 text-primary">
                Restaurer
              </button>
              <button onClick={handleBulkDelete} className="px-3 py-1 rounded bg-destructive/10 text-destructive">
                Supprimer def.
              </button>
            </>
          ) : (
            <button onClick={handleBulkTrash} className="px-3 py-1 rounded bg-destructive/10 text-destructive">
              Mettre a la corbeille
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} />
                </th>
                <th className="p-3 text-left">ID</th>
                <th className="p-3 text-left">Client</th>
                <th className="p-3 text-left">Tel</th>
                <th className="p-3 text-left">Produit</th>
                <th className="p-3 text-left">Total</th>
                <th className="p-3 text-left">Statut</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggleSelect(o.id)}
                    />
                  </td>
                  <td className="p-3 font-mono text-xs">{o.id.slice(-12)}</td>
                  <td className="p-3 font-medium">
                    <button onClick={() => setViewId(o.id)} className="hover:underline">
                      {o.nom || "?"}
                    </button>
                  </td>
                  <td className="p-3 text-muted-foreground">{o.telephone}</td>
                  <td className="p-3 max-w-[200px] truncate">{o.produit}</td>
                  <td className="p-3 font-medium">{o.totalCommande} DT</td>
                  <td className="p-3">
                    <select
                      value={o.statut}
                      onChange={(e) => handleStatusChange(o.id, e.target.value)}
                      className={`text-xs rounded px-1.5 py-0.5 border ${statusColor(o.statut)}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(o.date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setViewId(o.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        Voir
                      </button>
                      {showTrash ? (
                        <button
                          onClick={async () => { await bulkRestoreOrders([o.id]); loadOrders(); }}
                          className="text-xs text-green-600 hover:underline"
                        >
                          Rest.
                        </button>
                      ) : (
                        <button
                          onClick={async () => { await bulkTrashOrders([o.id]); loadOrders(); }}
                          className="text-xs text-destructive hover:underline"
                        >
                          Corb.
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">
                    Aucune commande
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
