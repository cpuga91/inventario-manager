"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";

interface DashboardData {
  stockoutRisks: Array<{
    id: string; sku: string; title: string; destinationName: string;
    daysOfCover: number; transferQty: number; capitalTied: number | null; priority: number;
  }>;
  overstockRisks: Array<{
    id: string; sku: string; title: string; locationName: string;
    daysOfCover: number; capitalTied: number | null; discountBucket: number; rationale: string;
  }>;
  reorderFlags: Array<{
    id: string; sku: string; title: string; warehouseOnHand: number; warehouseDaysOfCover: number;
  }>;
  summary: { variantCount: number; orderCount: number; inventoryCount: number };
  warehouseHealth: { totalOnHand: number; skuCount: number; reorderFlags: number } | null;
  alerts: Array<{ id: string; type: string; message: string; severity: string; read: boolean; createdAt: string }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; email: string; role: string } | null>(null);
  const [tenant, setTenant] = useState<{ name: string } | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/dashboard").then((r) => r.json()),
    ])
      .then(([auth, dashboard]) => {
        if (auth.error) { router.push("/login"); return; }
        setUser(auth.user);
        setTenant(auth.tenant);
        setData(dashboard);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !user || !tenant || !data) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav user={user} tenant={tenant} />
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">Variants</div>
            <div className="text-2xl font-bold">{data.summary.variantCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">Orders Synced</div>
            <div className="text-2xl font-bold">{data.summary.orderCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">Warehouse On-Hand</div>
            <div className="text-2xl font-bold">{data.warehouseHealth?.totalOnHand ?? "N/A"}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-sm text-gray-500">Reorder Flags</div>
            <div className="text-2xl font-bold text-red-600">{data.warehouseHealth?.reorderFlags ?? 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Stockout Risks */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold mb-3 text-red-700">Top Stockout Risks</h2>
            {data.stockoutRisks.length === 0 ? (
              <p className="text-gray-500 text-sm">No stockout risks detected</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2">SKU</th>
                      <th className="pb-2">Location</th>
                      <th className="pb-2">Cover</th>
                      <th className="pb-2">Transfer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stockoutRisks.slice(0, 8).map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{r.sku || r.title}</td>
                        <td className="py-2">{r.destinationName}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${r.daysOfCover < 5 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                            {r.daysOfCover?.toFixed(0)}d
                          </span>
                        </td>
                        <td className="py-2 font-medium">{r.transferQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top Overstock / Dead Stock */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold mb-3 text-amber-700">Overstock / Dead Stock</h2>
            {data.overstockRisks.length === 0 ? (
              <p className="text-gray-500 text-sm">No overstock risks detected</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2">SKU</th>
                      <th className="pb-2">Location</th>
                      <th className="pb-2">Cover</th>
                      <th className="pb-2">Capital</th>
                      <th className="pb-2">Discount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overstockRisks.slice(0, 8).map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{r.sku || r.title}</td>
                        <td className="py-2">{r.locationName}</td>
                        <td className="py-2">{r.daysOfCover?.toFixed(0)}d</td>
                        <td className="py-2">{r.capitalTied !== null ? `$${r.capitalTied.toFixed(0)}` : "N/A"}</td>
                        <td className="py-2">
                          <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                            {r.discountBucket}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Warehouse Reorder Flags */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold mb-3 text-blue-700">Warehouse Reorder Needed</h2>
            {data.reorderFlags.length === 0 ? (
              <p className="text-gray-500 text-sm">Warehouse stock is healthy</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2">SKU</th>
                      <th className="pb-2">On-Hand</th>
                      <th className="pb-2">Cover Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reorderFlags.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{r.sku || r.title}</td>
                        <td className="py-2">{r.warehouseOnHand}</td>
                        <td className="py-2">
                          <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                            {r.warehouseDaysOfCover?.toFixed(0)}d
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Alerts */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold mb-3">Recent Alerts</h2>
            {data.alerts.length === 0 ? (
              <p className="text-gray-500 text-sm">No alerts</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.alerts.slice(0, 10).map((a) => (
                  <div
                    key={a.id}
                    className={`p-2 rounded text-sm ${
                      a.severity === "critical"
                        ? "bg-red-50 text-red-800"
                        : a.severity === "warning"
                        ? "bg-yellow-50 text-yellow-800"
                        : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {a.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
