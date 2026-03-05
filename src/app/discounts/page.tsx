"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";

interface Discount {
  id: string; sku: string; title: string; productTitle: string; locationName: string;
  onHand: number; daysOfCover: number; daysSinceLastSale: number | null;
  capitalTied: number | null; discountBucket: number; rationale: string;
  status: string; reviewedAt: string | null;
}

export default function DiscountsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; email: string; role: string } | null>(null);
  const [tenant, setTenant] = useState<{ name: string } | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/discounts").then((r) => r.json()),
    ])
      .then(([auth, data]) => {
        if (auth.error) { router.push("/login"); return; }
        setUser(auth.user);
        setTenant(auth.tenant);
        setDiscounts(data.discounts || []);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const markReviewed = async (ids: string[]) => {
    await fetch("/api/discounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status: "reviewed" }),
    });
    setDiscounts((prev) =>
      prev.map((d) => (ids.includes(d.id) ? { ...d, status: "reviewed", reviewedAt: new Date().toISOString() } : d))
    );
  };

  if (loading || !user || !tenant) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav user={user} tenant={tenant} />
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Discount Recommendations</h1>
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="p-3">SKU</th>
                <th className="p-3">Product</th>
                <th className="p-3">Location</th>
                <th className="p-3">On Hand</th>
                <th className="p-3">Cover (d)</th>
                <th className="p-3">Days No Sale</th>
                <th className="p-3">Capital Tied</th>
                <th className="p-3">Discount</th>
                <th className="p-3">Rationale</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{d.sku || "-"}</td>
                  <td className="p-3">{d.productTitle} / {d.title}</td>
                  <td className="p-3">{d.locationName}</td>
                  <td className="p-3">{d.onHand}</td>
                  <td className="p-3">{d.daysOfCover?.toFixed(0)}</td>
                  <td className="p-3">{d.daysSinceLastSale ?? "N/A"}</td>
                  <td className="p-3">{d.capitalTied !== null ? `$${d.capitalTied.toFixed(0)}` : "N/A"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      d.discountBucket >= 30 ? "bg-red-100 text-red-700"
                      : d.discountBucket >= 20 ? "bg-orange-100 text-orange-700"
                      : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {d.discountBucket}% off
                    </span>
                  </td>
                  <td className="p-3 text-xs text-gray-600 max-w-xs">{d.rationale}</td>
                  <td className="p-3">
                    {d.status === "reviewed" ? (
                      <span className="text-green-600 text-xs">Reviewed</span>
                    ) : (
                      <button
                        onClick={() => markReviewed([d.id])}
                        className="bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-xs"
                      >
                        Mark Reviewed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {discounts.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-gray-500">No discount recommendations</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
