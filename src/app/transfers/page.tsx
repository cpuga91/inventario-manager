"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";

interface Transfer {
  id: string; sku: string; title: string; productTitle: string; vendor: string;
  destinationName: string; destinationLocationId: string;
  warehouseOnHand: number; destOnHand: number; avgDailySales30: number;
  daysOfCover: number; targetOnHand: number; transferQty: number;
  stockoutRisk: boolean; capitalTied: number | null; priority: number; status: string;
}

interface Location {
  id: string; name: string;
}

export default function TransfersPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; email: string; role: string } | null>(null);
  const [tenant, setTenant] = useState<{ name: string } | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterLocation, setFilterLocation] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [useAiPriority, setUseAiPriority] = useState(false);
  const [aiTransfers, setAiTransfers] = useState<Array<{ sku: string; variant_id: string; priority: number; qty: number }>>([]);
  const [hasAiData, setHasAiData] = useState(false);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterLocation) params.set("locationId", filterLocation);
    if (search) params.set("search", search);

    const [auth, transferData] = await Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch(`/api/transfers?${params}`).then((r) => r.json()),
    ]);

    if (auth.error) { router.push("/login"); return; }
    setUser(auth.user);
    setTenant(auth.tenant);
    setTransfers(transferData.transfers || []);
    setLocations(transferData.locations || []);
    setLoading(false);

    // Load AI insights for priority toggle
    try {
      const aiData = await fetch("/api/ai-insights").then((r) => r.json());
      if (aiData.insights?.prioritized_transfers?.length > 0) {
        setAiTransfers(aiData.insights.prioritized_transfers);
        setHasAiData(true);
      }
    } catch { /* AI data is optional */ }
  }, [filterLocation, search, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusUpdate = async (status: string) => {
    if (selectedIds.size === 0) return;
    await fetch("/api/transfers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds), status }),
    });
    setSelectedIds(new Set());
    fetchData();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === transfers.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(transfers.map((t) => t.id)));
  };

  // Apply AI prioritization if toggled on
  const displayTransfers = useAiPriority && hasAiData
    ? [...transfers].sort((a, b) => {
        const aiA = aiTransfers.find((ai) => ai.sku === a.sku);
        const aiB = aiTransfers.find((ai) => ai.sku === b.sku);
        return (aiB?.priority ?? 0) - (aiA?.priority ?? 0);
      })
    : transfers;

  const getAiSuggestedQty = (sku: string): number | null => {
    if (!useAiPriority || !hasAiData) return null;
    return aiTransfers.find((ai) => ai.sku === sku)?.qty ?? null;
  };

  if (loading || !user || !tenant) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav user={user} tenant={tenant} />
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Transfer Plan</h1>
          <div className="flex space-x-2">
            <a
              href={`/api/transfers/csv${filterLocation ? `?locationId=${filterLocation}` : ""}`}
              className="bg-emerald-600 text-white px-4 py-2 rounded text-sm hover:bg-emerald-700"
            >
              Export CSV
            </a>
            {selectedIds.size > 0 && (
              <>
                <button onClick={() => handleStatusUpdate("picked")} className="bg-blue-600 text-white px-3 py-2 rounded text-sm">Mark Picked</button>
                <button onClick={() => handleStatusUpdate("shipped")} className="bg-indigo-600 text-white px-3 py-2 rounded text-sm">Mark Shipped</button>
                <button onClick={() => handleStatusUpdate("received")} className="bg-green-600 text-white px-3 py-2 rounded text-sm">Mark Received</button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex space-x-4 mb-4">
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search SKU or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2 text-sm flex-1 max-w-md"
          />
          {hasAiData && (
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={useAiPriority}
                onChange={(e) => setUseAiPriority(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-700">AI prioritization</span>
            </label>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="p-3">
                  <input type="checkbox" onChange={selectAll} checked={selectedIds.size === transfers.length && transfers.length > 0} />
                </th>
                <th className="p-3">SKU</th>
                <th className="p-3">Product</th>
                <th className="p-3">Destination</th>
                <th className="p-3">WH Stock</th>
                <th className="p-3">Dest Stock</th>
                <th className="p-3">Avg Sales/d</th>
                <th className="p-3">Cover (d)</th>
                <th className="p-3">Transfer Qty</th>
                {useAiPriority && <th className="p-3">AI Qty</th>}
                <th className="p-3">Risk</th>
                <th className="p-3">Capital</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayTransfers.map((t) => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} />
                  </td>
                  <td className="p-3 font-medium">{t.sku || "-"}</td>
                  <td className="p-3">{t.productTitle} / {t.title}</td>
                  <td className="p-3">{t.destinationName}</td>
                  <td className="p-3">{t.warehouseOnHand}</td>
                  <td className="p-3">{t.destOnHand}</td>
                  <td className="p-3">{t.avgDailySales30?.toFixed(1)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      t.daysOfCover < 5 ? "bg-red-100 text-red-700"
                      : t.daysOfCover < 15 ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                    }`}>
                      {t.daysOfCover?.toFixed(0)}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-emerald-700">{t.transferQty}</td>
                  {useAiPriority && (
                    <td className="p-3 text-purple-700 font-medium">
                      {getAiSuggestedQty(t.sku) !== null ? getAiSuggestedQty(t.sku) : "-"}
                    </td>
                  )}
                  <td className="p-3">
                    {t.stockoutRisk && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">STOCKOUT</span>}
                  </td>
                  <td className="p-3">{t.capitalTied !== null ? `$${t.capitalTied.toFixed(0)}` : "N/A"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      t.status === "pending" ? "bg-gray-100"
                      : t.status === "picked" ? "bg-blue-100 text-blue-700"
                      : t.status === "shipped" ? "bg-indigo-100 text-indigo-700"
                      : "bg-green-100 text-green-700"
                    }`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr><td colSpan={useAiPriority ? 13 : 12} className="p-6 text-center text-gray-500">No transfer recommendations</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
