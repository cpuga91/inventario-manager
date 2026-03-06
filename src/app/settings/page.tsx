"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";

interface OpenAiSettingsState {
  isEnabled: boolean;
  model: string;
  dailyHourLocal: number;
  timezone: string;
  maxSkus: number;
  promptVersion: string;
  keyStorageMode: "ENV_ONLY" | "DB_ENCRYPTED";
  hasStoredKey: boolean;
  apiKeyLast4: string | null;
}

interface WizardState {
  wizardStep: number;
  wizardComplete: boolean;
  lastUpdated: string | null;
}

type ResetMode = "SOFT" | "HARD" | null;

function ResetModal({
  mode,
  onClose,
  onSuccess,
}: {
  mode: ResetMode;
  onClose: () => void;
  onSuccess: (mode: string, deletedCounts?: Record<string, number>) => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!mode) return null;

  const expected = mode === "SOFT" ? "RESET WIZARD" : "DELETE TENANT DATA";
  const isSoft = mode === "SOFT";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className={`text-lg font-bold mb-2 ${isSoft ? "text-amber-700" : "text-red-700"}`}>
          {isSoft ? "Restart Setup Wizard" : "Hard Reset — Delete Tenant Data"}
        </h3>
        <div className={`text-sm mb-4 ${isSoft ? "text-gray-600" : "text-red-600"}`}>
          {isSoft ? (
            <p>This will reset the wizard to step 1 so you can re-run onboarding. All historical data (orders, inventory, recommendations) will be <strong>preserved</strong>.</p>
          ) : (
            <>
              <p className="mb-2">This will <strong>permanently delete</strong> all tenant operational data:</p>
              <ul className="list-disc ml-5 space-y-0.5">
                <li>Orders &amp; order lines</li>
                <li>Inventory levels &amp; daily sales</li>
                <li>Products &amp; variants cache</li>
                <li>Recommendations &amp; AI runs</li>
                <li>Location mappings &amp; business rules</li>
                <li>Alerts &amp; notifications</li>
                <li>OpenAI settings</li>
              </ul>
              <p className="mt-2 font-semibold">This action cannot be undone.</p>
            </>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type <code className="bg-gray-100 px-1 rounded font-bold">{expected}</code> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => { setConfirmText(e.target.value); setError(""); }}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder={expected}
            autoComplete="off"
          />
        </div>

        {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (confirmText !== expected) {
                setError(`Please type exactly: ${expected}`);
                return;
              }
              setSubmitting(true);
              setError("");
              try {
                const res = await fetch("/api/admin/wizard-reset", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ mode, confirmText }),
                });
                const data = await res.json();
                if (data.ok) {
                  onSuccess(mode, data.deletedCounts);
                } else {
                  setError(data.error || "Reset failed");
                }
              } catch {
                setError("Request failed");
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting || confirmText !== expected}
            className={`px-4 py-2 text-sm text-white rounded font-medium disabled:opacity-50 ${
              isSoft
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {submitting ? "Processing..." : isSoft ? "Reset Wizard" : "Delete & Reset"}
          </button>
        </div>
      </div>
    </div>
  );
}

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

  // OpenAI settings state
  const [aiSettings, setAiSettings] = useState<OpenAiSettingsState>({
    isEnabled: false,
    model: "gpt-4o-mini",
    dailyHourLocal: 7,
    timezone: "America/Santiago",
    maxSkus: 150,
    promptVersion: "v1.0",
    keyStorageMode: "ENV_ONLY",
    hasStoredKey: false,
    apiKeyLast4: null,
  });
  const [encryptionAvailable, setEncryptionAvailable] = useState(false);
  const [envKeyConfigured, setEnvKeyConfigured] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [runningAi, setRunningAi] = useState(false);

  // Wizard reset state
  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [resetMode, setResetMode] = useState<ResetMode>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/admin/openai-settings").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/admin/wizard-reset").then((r) => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([auth, data, aiData, wizData]) => {
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
        if (aiData?.settings) {
          setAiSettings(aiData.settings);
          setEncryptionAvailable(aiData.encryptionAvailable ?? false);
          setEnvKeyConfigured(aiData.envKeyConfigured ?? false);
        }
        if (wizData) {
          setWizardState(wizData);
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

  const handleAiSave = async () => {
    setAiSaving(true);
    setAiMessage("");
    try {
      const payload: Record<string, unknown> = {
        isEnabled: aiSettings.isEnabled,
        model: aiSettings.model,
        dailyHourLocal: aiSettings.dailyHourLocal,
        timezone: aiSettings.timezone,
        maxSkus: aiSettings.maxSkus,
        keyStorageMode: aiSettings.keyStorageMode,
      };
      if (apiKeyInput.trim()) {
        payload.apiKey = apiKeyInput.trim();
      }
      const res = await fetch("/api/admin/openai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setAiSettings(data.settings);
        setApiKeyInput("");
        setAiMessage("OpenAI settings saved");
      } else {
        setAiMessage("Error: " + (data.error || data.details?.join(", ")));
      }
    } catch {
      setAiMessage("Failed to save OpenAI settings");
    } finally {
      setAiSaving(false);
    }
  };

  const handleRemoveKey = async () => {
    setAiSaving(true);
    setAiMessage("");
    try {
      const res = await fetch("/api/admin/openai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeKey: true }),
      });
      const data = await res.json();
      if (data.success) {
        setAiSettings(data.settings);
        setAiMessage("Stored API key removed");
      } else {
        setAiMessage("Error: " + data.error);
      }
    } catch {
      setAiMessage("Failed to remove key");
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setAiMessage("");
    try {
      const res = await fetch("/api/admin/openai-test", { method: "POST" });
      const data = await res.json();
      setAiMessage(data.success ? data.message : "Test failed: " + data.message);
    } catch {
      setAiMessage("Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleRunAiNow = async () => {
    setRunningAi(true);
    setAiMessage("Running AI analysis...");
    try {
      const res = await fetch("/api/admin/openai-run", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setAiMessage(`AI analysis complete: ${data.run.status}. View results in AI Insights.`);
      } else {
        setAiMessage("Error: " + data.error);
      }
    } catch {
      setAiMessage("AI run failed");
    } finally {
      setRunningAi(false);
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

        {/* OpenAI Settings — ADMIN only */}
        {user.role === "ADMIN" && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">OpenAI Configuration</h2>

            {aiMessage && (
              <div className={`p-3 rounded text-sm mb-4 ${aiMessage.startsWith("Error") || aiMessage.includes("failed") || aiMessage.includes("Failed") ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                {aiMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Enable toggle */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    className={`relative w-11 h-6 rounded-full transition-colors ${aiSettings.isEnabled ? "bg-emerald-500" : "bg-gray-300"}`}
                    onClick={() => setAiSettings({ ...aiSettings, isEnabled: !aiSettings.isEnabled })}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${aiSettings.isEnabled ? "translate-x-5.5 left-[1.375rem]" : "left-0.5"}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Enable OpenAI Daily Insights</span>
                </label>
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <select
                  value={aiSettings.model}
                  onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                  <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                </select>
              </div>

              {/* Daily hour */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Daily Run Hour (0-23)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={aiSettings.dailyHourLocal}
                  onChange={(e) => setAiSettings({ ...aiSettings, dailyHourLocal: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <input
                  type="text"
                  value={aiSettings.timezone}
                  onChange={(e) => setAiSettings({ ...aiSettings, timezone: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="America/Santiago"
                />
              </div>

              {/* Max SKUs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max SKUs per Run</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={aiSettings.maxSkus}
                  onChange={(e) => setAiSettings({ ...aiSettings, maxSkus: parseInt(e.target.value) || 150 })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>

              {/* Prompt version (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Version</label>
                <input
                  type="text"
                  value={aiSettings.promptVersion}
                  readOnly
                  className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-500"
                />
              </div>
            </div>

            {/* API Key Management */}
            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">API Key Management</h3>

              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="keyStorageMode"
                    checked={aiSettings.keyStorageMode === "ENV_ONLY"}
                    onChange={() => setAiSettings({ ...aiSettings, keyStorageMode: "ENV_ONLY" })}
                    className="text-emerald-600"
                  />
                  <span className="text-sm text-gray-700">Manage key via Environment Variable</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="keyStorageMode"
                    checked={aiSettings.keyStorageMode === "DB_ENCRYPTED"}
                    onChange={() => setAiSettings({ ...aiSettings, keyStorageMode: "DB_ENCRYPTED" })}
                    disabled={!encryptionAvailable}
                    className="text-emerald-600"
                  />
                  <span className={`text-sm ${encryptionAvailable ? "text-gray-700" : "text-gray-400"}`}>
                    Store key encrypted in app
                    {!encryptionAvailable && " (set APP_ENCRYPTION_KEY first)"}
                  </span>
                </label>
              </div>

              {aiSettings.keyStorageMode === "ENV_ONLY" && (
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
                  Set <code className="bg-gray-200 px-1 rounded">OPENAI_API_KEY</code> in your Replit Secrets or <code className="bg-gray-200 px-1 rounded">.env</code> file.
                  {envKeyConfigured && (
                    <span className="ml-2 text-emerald-600 font-medium">Environment key is configured.</span>
                  )}
                  {!envKeyConfigured && (
                    <span className="ml-2 text-amber-600 font-medium">No environment key detected.</span>
                  )}
                </div>
              )}

              {aiSettings.keyStorageMode === "DB_ENCRYPTED" && (
                <div className="space-y-3">
                  {aiSettings.hasStoredKey && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-emerald-600 font-medium">
                        Key stored (last 4: {aiSettings.apiKeyLast4 || "****"})
                      </span>
                      <button
                        onClick={handleRemoveKey}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                        disabled={aiSaving}
                      >
                        Remove stored key
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      {aiSettings.hasStoredKey ? "Replace API Key" : "Paste API Key"}
                    </label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="sk-..."
                      className="w-full max-w-md border rounded px-3 py-2 text-sm"
                      autoComplete="off"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={handleAiSave}
                disabled={aiSaving}
                className="bg-emerald-600 text-white px-6 py-2 rounded font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {aiSaving ? "Saving..." : "Save OpenAI Settings"}
              </button>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {testing ? "Testing..." : "Test OpenAI Connection"}
              </button>
              <button
                onClick={handleRunAiNow}
                disabled={runningAi}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {runningAi ? "Running..." : "Run AI Analysis Now"}
              </button>
            </div>
          </div>
        )}

        {/* Setup Wizard — ADMIN only */}
        {user.role === "ADMIN" && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Setup Wizard</h2>

            {wizardState && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Status</span>
                  <p className={`text-sm font-medium ${wizardState.wizardComplete ? "text-emerald-600" : "text-amber-600"}`}>
                    {wizardState.wizardComplete ? "Configured" : "Not configured"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Current Step</span>
                  <p className="text-sm font-medium text-gray-900">{wizardState.wizardStep} / 4</p>
                </div>
                {wizardState.lastUpdated && (
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Last Updated</span>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(wizardState.lastUpdated).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setResetMode("SOFT")}
                className="bg-amber-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-amber-700"
              >
                Restart Wizard (Soft Reset)
              </button>
              <button
                onClick={() => setResetMode("HARD")}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700"
              >
                Reset &amp; Remove Tenant Data (Hard Reset)
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-3">
              Soft reset re-runs the wizard keeping historical data. Hard reset purges all tenant data for a clean start.
            </p>
          </div>
        )}

        {/* Reset Confirmation Modal */}
        <ResetModal
          mode={resetMode}
          onClose={() => setResetMode(null)}
          onSuccess={(mode, deletedCounts) => {
            setResetMode(null);
            if (mode === "HARD" && deletedCounts) {
              const total = Object.values(deletedCounts).reduce((a, b) => a + b, 0);
              setMessage(`Hard reset complete. ${total} records deleted. Redirecting to wizard...`);
            } else {
              setMessage("Wizard reset. Redirecting to wizard...");
            }
            setTimeout(() => router.push("/wizard"), 1500);
          }}
        />
      </div>
    </div>
  );
}
