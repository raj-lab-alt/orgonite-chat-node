import { useEffect, useState } from "react";
import { getStats } from "@/lib/admin-api";

interface Stats {
  period: number;
  summary: any;
  modes: any[];
  topProducts: any[];
  orderStats: any;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    getStats(days)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const s = stats?.summary || {};
  const os = stats?.orderStats || {};

  const KPI_CARDS = [
    { label: "Sessions", value: s.sessions || 0, sub: `${s.total_messages || 0} messages` },
    { label: "Visiteurs uniques", value: s.unique_visitors || 0, sub: `Conversion ${s.visitor_to_conversation_rate || 0}%` },
    { label: "Commandes", value: s.total_commandes || 0, sub: `CA ${s.ca_total || 0} DT` },
    { label: "Taux livraison", value: `${os.delivery_rate || 0}%`, sub: `${os.delivered_orders || 0} livrees` },
    { label: "Panier moyen", value: `${s.avg_order_value || 0} DT`, sub: `${s.avg_messages_to_order || 0} msg/commande` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="text-sm border rounded px-2 py-1"
        >
          <option value={7}>7 jours</option>
          <option value={30}>30 jours</option>
          <option value={90}>90 jours</option>
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {KPI_CARDS.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Modes breakdown */}
        <div className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold mb-3">Modes de conversation</h2>
          <div className="space-y-2">
            {(stats?.modes || []).map((m: any) => (
              <div key={m.mode} className="flex items-center justify-between text-sm">
                <span>Mode {m.mode}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          ((m.total || 0) / Math.max(1, (stats?.modes || []).reduce((a: number, b: any) => a + (b.total || 0), 0))) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-muted-foreground min-w-[3ch] text-right">
                    {m.total || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top products */}
        <div className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold mb-3">Top produits</h2>
          <div className="space-y-2">
            {(stats?.topProducts || []).slice(0, 5).map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate flex-1">{p.produit || "Inconnu"}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground ml-2">
                  <span>{p.orders_count} cmd</span>
                  <span>{p.revenue} DT</span>
                  <span className={p.delivery_rate >= 50 ? "text-green-600" : "text-orange-600"}>
                    {p.delivery_rate}%
                  </span>
                </div>
              </div>
            ))}
            {(!stats?.topProducts || stats.topProducts.length === 0) && (
              <p className="text-sm text-muted-foreground">Aucune commande</p>
            )}
          </div>
        </div>
      </div>

      {/* Order stats summary */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold mb-3">Synthese commandes</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="font-semibold">{os.total_orders || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Livrees</p>
            <p className="font-semibold text-green-600">{os.delivered_orders || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Echouees</p>
            <p className="font-semibold text-destructive">{os.failed_orders || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">CA total</p>
            <p className="font-semibold">{os.orders_revenue || 0} DT</p>
          </div>
        </div>
      </div>
    </div>
  );
}
