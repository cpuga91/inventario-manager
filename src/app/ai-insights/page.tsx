"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";

interface AiRun {
  id: string;
  runDate: string;
  status: "SUCCESS" | "FAILED";
  model: string;
  promptVersion?: string;
  tokensIn: number | null;
  tokensOut: number | null;
  errorMessage: string | null;
  reviewed: boolean;
  createdAt: string;
}

interface AiInsights {
  date: string;
  tenant: { id: string; name: string };
  summary: {
    headline: string;
    top_risk_locations: Array<{ location: string; reason: string }>;
    notes: string[];
  };
  prioritized_transfers: Array<{
    sku: string; variant_id: string; from_location: string; to_location: string;
    qty: number; priority: number; confidence: number; rationale: string;
    evidence: {
      dest_on_hand: number; warehouse_on_hand: number; avg_daily_sales_30: number;
      days_of_cover: number; lead_time_days: number; safety_days: number;
    };
  }>;
  discount_actions: Array<{
    sku: string; variant_id: string; location: string; discount_pct: number;
    confidence: number; rationale: string;
    evidence: { days_without_sale: number; days_of_cover: number; on_hand: number; cogs: number | null; capital_tied: number | null };
  }>;
  anomalies: Array<{
    sku: string; variant_id: string; location: string;
    type: string; confidence: number; description: string;
    evidence: { metric: string; value: number; baseline: number };
  }>;
  parameter_suggestions: Array<{
    param: string; suggested_value: number; confidence: number; reason: string;
  }>;
}

export default function AiInsightsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; email: string; role: string } | null>(null);
  const [tenant, setTenant] = useState<{ name: string } | null>(null);
  const [run, setRun] = useState<AiRun | null>(null);
  const [insights, setInsights] = useState<AiInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [auth, aiData] = await Promise.all([
        fetch("/api/auth/me").then((r) => r.json()),
        fetch("/api/ai-insights").then((r) => r.json()),
      ]);
      if (auth.error) { router.push("/login"); return; }
      setUser(auth.user);
      setTenant(auth.tenant);
      setRun(aiData.run);
      setInsights(aiData.insights);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const triggerRun = async () => {
    setRunning(true);
    setError("");
    try {
      const res = await fetch("/api/ai-insights", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setRun(data.run);
        setInsights(data.insights);
      }
    } catch {
      setError("Failed to run AI analysis");
    } finally {
      setRunning(false);
    }
  };

  const markReviewed = async () => {
    if (!run) return;
    await fetch("/api/ai-insights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: run.id }),
    });
    setRun({ ...run, reviewed: true });
  };

  if (loading || !user || !tenant) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav user={user} tenant={tenant} />
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
          <div className="flex space-x-2">
            {run && !run.reviewed && run.status === "SUCCESS" && (
              <button onClick={markReviewed} className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">
                Mark Reviewed
              </button>
            )}
            <button
              onClick={triggerRun}
              disabled={running}
              className="bg-emerald-600 text-white px-4 py-2 rounded text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {running ? "Running..." : "Run AI Analysis"}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded text-sm mb-4">{error}</div>}

        {/* Run Status */}
        {run && (
          <div className={`p-4 rounded-lg mb-6 ${run.status === "SUCCESS" ? "bg-green-50" : "bg-red-50"}`}>
            <div className="flex justify-between items-center">
              <div>
                <span className={`text-sm font-medium ${run.status === "SUCCESS" ? "text-green-800" : "text-red-800"}`}>
                  Last run: {new Date(run.createdAt).toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 ml-3">
                  Model: {run.model} | Tokens: {run.tokensIn ?? 0} in / {run.tokensOut ?? 0} out
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                run.status === "SUCCESS" ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"
              }`}>
                {run.status}
              </span>
            </div>
            {run.errorMessage && <p className="text-sm text-red-700 mt-2">{run.errorMessage}</p>}
            {run.reviewed && <span className="text-xs text-gray-500 mt-1 block">Reviewed</span>}
          </div>
        )}

        {!run && (
          <div className="bg-gray-100 p-8 rounded-lg text-center text-gray-500">
            <p className="text-lg mb-2">No AI analysis runs yet</p>
            <p className="text-sm">Click &ldquo;Run AI Analysis&rdquo; to generate insights, or configure OPENAI_API_KEY in your .env file.</p>
          </div>
        )}

        {/* Insights */}
        {insights && run?.status === "SUCCESS" && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Summary</h2>
              <p className="text-gray-700 text-lg mb-4">{insights.summary.headline}</p>

              {insights.summary.top_risk_locations.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Top Risk Locations</h3>
                  <ul className="space-y-1">
                    {insights.summary.top_risk_locations.map((loc, i) => (
                      <li key={i} className="text-sm text-red-700 bg-red-50 px-3 py-1 rounded">
                        <span className="font-medium">{loc.location}:</span> {loc.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.summary.notes.length > 0 && (
                <ul className="space-y-1">
                  {insights.summary.notes.map((note, i) => (
                    <li key={i} className="text-sm text-gray-600">- {note}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Prioritized Transfers */}
            {insights.prioritized_transfers.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  AI Prioritized Transfers ({insights.prioritized_transfers.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b bg-gray-50">
                        <th className="p-3">Priority</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">To</th>
                        <th className="p-3">Qty</th>
                        <th className="p-3">Confidence</th>
                        <th className="p-3">Cover (d)</th>
                        <th className="p-3">Rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.prioritized_transfers.map((t, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              t.priority >= 70 ? "bg-red-100 text-red-700"
                              : t.priority >= 40 ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                            }`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="p-3 font-medium">{t.sku}</td>
                          <td className="p-3">{t.to_location}</td>
                          <td className="p-3 font-bold text-emerald-700">{t.qty}</td>
                          <td className="p-3">{(t.confidence * 100).toFixed(0)}%</td>
                          <td className="p-3">{t.evidence.days_of_cover.toFixed(0)}</td>
                          <td className="p-3 text-gray-600 max-w-xs truncate">{t.rationale}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Discount Actions */}
            {insights.discount_actions.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  AI Discount Suggestions ({insights.discount_actions.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b bg-gray-50">
                        <th className="p-3">SKU</th>
                        <th className="p-3">Location</th>
                        <th className="p-3">Discount %</th>
                        <th className="p-3">Confidence</th>
                        <th className="p-3">On Hand</th>
                        <th className="p-3">Cover (d)</th>
                        <th className="p-3">Rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.discount_actions.map((d, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{d.sku}</td>
                          <td className="p-3">{d.location}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              d.discount_pct >= 30 ? "bg-red-100 text-red-700"
                              : d.discount_pct >= 20 ? "bg-yellow-100 text-yellow-700"
                              : "bg-blue-100 text-blue-700"
                            }`}>
                              {d.discount_pct}%
                            </span>
                          </td>
                          <td className="p-3">{(d.confidence * 100).toFixed(0)}%</td>
                          <td className="p-3">{d.evidence.on_hand}</td>
                          <td className="p-3">{d.evidence.days_of_cover.toFixed(0)}</td>
                          <td className="p-3 text-gray-600 max-w-xs truncate">{d.rationale}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Anomalies */}
            {insights.anomalies.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Anomalies Detected ({insights.anomalies.length})
                </h2>
                <div className="space-y-3">
                  {insights.anomalies.map((a, i) => (
                    <div key={i} className="bg-yellow-50 border border-yellow-200 rounded p-4">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-200 text-yellow-800">
                          {a.type.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{a.sku}</span>
                        <span className="text-xs text-gray-500">at {a.location}</span>
                        <span className="text-xs text-gray-500">({(a.confidence * 100).toFixed(0)}% confidence)</span>
                      </div>
                      <p className="text-sm text-gray-700">{a.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {a.evidence.metric}: {a.evidence.value} (baseline: {a.evidence.baseline})
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parameter Suggestions */}
            {insights.parameter_suggestions.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Parameter Suggestions</h2>
                <div className="space-y-3">
                  {insights.parameter_suggestions.map((p, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-200 rounded p-4">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-blue-800">
                          {p.param.replace(/_/g, " ")}: {p.suggested_value}
                        </span>
                        <span className="text-xs text-gray-500">({(p.confidence * 100).toFixed(0)}% confidence)</span>
                      </div>
                      <p className="text-sm text-gray-700">{p.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
