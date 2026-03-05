"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";

interface VariantCogs {
  id: string; sku: string; title: string; productTitle: string;
  cogs: number | null; cogsSource: string | null; cogsUpdatedAt: string | null;
}

export default function CogsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; email: string; role: string } | null>(null);
  const [tenant, setTenant] = useState<{ name: string } | null>(null);
  const [variants, setVariants] = useState<VariantCogs[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ total: number; success: number; errors: number; results: Array<{ sku: string; status: string; error?: string }> } | null>(null);
  const [writeToShopify, setWriteToShopify] = useState(false);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);

    const [auth, data] = await Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch(`/api/cogs?${params}`).then((r) => r.json()),
    ]);

    if (auth.error) { router.push("/login"); return; }
    setUser(auth.user);
    setTenant(auth.tenant);
    setVariants(data.variants || []);
    setLoading(false);
  }, [search, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("writeToShopify", writeToShopify.toString());

    try {
      const res = await fetch("/api/cogs", { method: "POST", body: formData });
      const data = await res.json();
      setUploadResult(data);
      fetchData();
    } catch {
      setUploadResult({ total: 0, success: 0, errors: 1, results: [{ sku: "(file)", status: "error", error: "Upload failed" }] });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (loading || !user || !tenant) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav user={user} tenant={tenant} />
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">COGS Management</h1>

        {/* CSV Import */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Import COGS via CSV</h2>
          <p className="text-sm text-gray-600 mb-3">
            Upload a CSV file with columns: <code className="bg-gray-100 px-1">SKU, COGS</code>
          </p>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={writeToShopify}
                onChange={(e) => setWriteToShopify(e.target.checked)}
              />
              <span>Also write COGS to Shopify metafield (finance.cogs)</span>
            </label>
          </div>
          <div className="mt-3">
            <input
              type="file"
              accept=".csv"
              onChange={handleUpload}
              disabled={uploading}
              className="text-sm"
            />
            {uploading && <span className="text-sm text-blue-600 ml-2">Uploading...</span>}
          </div>

          {uploadResult && (
            <div className="mt-4 p-3 rounded bg-gray-50">
              <div className="text-sm font-medium mb-2">
                Import Results: {uploadResult.success}/{uploadResult.total} successful, {uploadResult.errors} errors
              </div>
              {uploadResult.results.filter((r) => r.status === "error").length > 0 && (
                <div className="text-sm text-red-600 space-y-1">
                  {uploadResult.results
                    .filter((r) => r.status === "error")
                    .map((r, i) => (
                      <div key={i}>SKU &quot;{r.sku}&quot;: {r.error}</div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search + Table */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search SKU or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-full max-w-md"
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="p-3">SKU</th>
                <th className="p-3">Product</th>
                <th className="p-3">Variant</th>
                <th className="p-3">COGS</th>
                <th className="p-3">Source</th>
                <th className="p-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{v.sku || "-"}</td>
                  <td className="p-3">{v.productTitle}</td>
                  <td className="p-3">{v.title}</td>
                  <td className="p-3">
                    {v.cogs !== null ? (
                      <span className="font-medium">${v.cogs.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-gray-500">{v.cogsSource || "-"}</td>
                  <td className="p-3 text-xs text-gray-500">
                    {v.cogsUpdatedAt ? new Date(v.cogsUpdatedAt).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
              {variants.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-500">No variants found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
