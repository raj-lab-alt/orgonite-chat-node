import { useEffect, useState } from "react";
import { getConfig, updateConfig } from "@/lib/admin-api";

export default function ConfigPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    getConfig()
      .then((data) => {
        setConfig(data);
        setSystemPrompt(data.systemPrompt || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await updateConfig({ systemPrompt });
      setMessage("Configuration sauvegardee");
    } catch (err: any) {
      setMessage(err.message);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configuration</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-50"
        >
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </button>
      </div>

      {message && (
        <div className={`text-sm p-2 rounded ${message.includes("erreur") ? "bg-destructive/10 text-destructive" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* System Prompt */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div>
          <h2 className="font-semibold">Prompt systeme</h2>
          <p className="text-xs text-muted-foreground">
            Source: {config?._promptSource === "file" ? "prompt-amine-structure.txt" : "config"}
          </p>
        </div>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="w-full border rounded px-3 py-2 text-xs font-mono leading-relaxed"
          rows={20}
        />
      </div>

      {/* API Keys info */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">API & Tracking</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Clés API Gemini</p>
            <p className="font-medium">{config?._apiKeyCount || 0} configuree(s)</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Modeles</p>
            <p className="font-medium">{(config?.models || []).join(", ") || "Aucun"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Facebook Pixel</p>
            <p className="font-medium">{(config?.facebookPixelIds || []).join(", ") || "Non configure"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Google Analytics</p>
            <p className="font-medium">{(config?.googleAnalyticsIds || []).join(", ") || "Non configure"}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Les cles API et tokens se configurent via le fichier <code className="bg-muted px-1 rounded">.env</code> sur le serveur.
        </p>
      </div>

      {/* Statuses */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Statuts de commande</h2>
        <div className="flex flex-wrap gap-2">
          {(config?.statuses || []).map((s: string) => (
            <span key={s} className="px-2 py-1 rounded bg-muted text-xs">{s}</span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Les statuts sont synchronises depuis le serveur.
        </p>
      </div>
    </div>
  );
}
