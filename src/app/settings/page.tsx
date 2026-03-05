"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; email: string; role: string } | null>(null);
  const [tenant, setTenant] = useState<{ name: string } | null>(null);
  const [rules, setRules] = useState({
    leadTimeDays: 3,
    safetyDays: 2,
    reviewCycleDays: 7,
    overstockThresholdDays: 90,
    deadStockDays: 180,
    warehouseBufferQty: 5,
    targetCoverDays: 30,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ])
      .then(([auth, data]) => {
        if (auth.error) { router.push("/login"); return; }
        setUser(auth.user);
        setTenant(auth.tenant);
        if (data.globalRule) {
          setRules({
            leadTimeDays: data.globalRule.leadTimeDays ?? 3,
            safetyDays: data.globalRule.safetyDays ?? 2,
            reviewCycleDays: data.globalRule.reviewCycleDays ?? 7,
            overstockThresholdDays: data.globalRule.overstockThresholdDays ?? 90,
            deadStockDays: data.globalRule.deadStockDays ?? 180,
            warehouseBufferQty: data.globalRule.warehouseBufferQty ?? 5,
            targetCoverDays: data.globalRule.targetCoverDays ?? 30,
          });
        }
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      const data = await res.json();
      if (data.success) setMessage("Settings saved");
      else setMessage("Error: " + data.error);
    } catch {
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    window.open("/api/settings/export", "_blank");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const config = JSON.parse(text);
      const res = await fetch("/api/settings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setMessage(data.message || "Imported");
    } catch {
      setMessage("Invalid JSON file");
    }
    e.target.value = "";
  };

  const handleRunAnalytics = async () => {
    setMessage("Running analytics...");
    try {
      const res = await fetch("/api/analytics/run", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage(`Analytics complete: ${data.transferCount} transfers, ${data.discountCount} discounts, ${data.reorderFlags} reorder flags`);
      } else {
        setMessage("Error: " + data.error);
      }
    } catch {
      setMessage("Analytics run failed");
    }
  };

  if (loading || !user || !tenant) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;
  }

  const fieldLabels: Record<string, string> = {
    leadTimeDays: "Lead Time (days) - warehouse to store",
    safetyDays: "Safety Stock (days)",
    reviewCycleDays: "Review Cycle (days)",
    overstockThresholdDays: "Overstock Threshold (days of cover)",
    deadStockDays: "Dead Stock (days without sale)",
    warehouseBufferQty: "Warehouse Buffer (qty to keep)",
    targetCoverDays: "Target Days of Cover",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav user={user} tenant={tenant} />
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {message && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded text-sm mb-4">{message}</div>
        )}

        {/* Global Thresholds */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Global Thresholds</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(rules).map(([key, val]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {fieldLabels[key] || key}
                </label>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => setRules({ ...rules, [key]: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  disabled={user.role !== "ADMIN"}
                />
              </div>
            ))}
          </div>
          {user.role === "ADMIN" && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 bg-emerald-600 text-white px-6 py-2 rounded font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Thresholds"}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRunAnalytics}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
            >
              Run Analytics Now
            </button>
            <button
              onClick={handleExport}
              className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700"
            >
              Export Config JSON
            </button>
            <label className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700 cursor-pointer">
              Import Config JSON
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
