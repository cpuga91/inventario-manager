"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import DataTableSkeleton from "@/components/DataTableSkeleton";
import StatusChip from "@/components/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign, Upload, Download, Search, FileText,
  CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface VariantCogs {
  id: string; sku: string; title: string; productTitle: string;
  cogs: number | null; cogsSource: string | null; cogsUpdatedAt: string | null;
}

function CogsContent() {
  const [variants, setVariants] = useState<VariantCogs[]>([]);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    total: number; success: number; errors: number;
    results: Array<{ sku: string; status: string; error?: string }>;
  } | null>(null);
  const [writeToShopify, setWriteToShopify] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (searchDebounced) params.set("search", searchDebounced);
    try {
      const res = await fetch(`/api/cogs?${params}`);
      const data = await res.json();
      setVariants(data.variants || []);
    } catch {
      toast.error("Failed to load COGS data");
    } finally {
      setLoading(false);
    }
  }, [searchDebounced]);

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
      if (data.success > 0) toast.success(`${data.success} COGS values updated`);
      if (data.errors > 0) toast.error(`${data.errors} errors during import`);
      fetchData();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const withCogsCount = variants.filter((v) => v.cogs !== null).length;
  const withoutCogsCount = variants.filter((v) => v.cogs === null).length;

  return (
    <div className="space-y-6">
      <PageHeader title="COGS Management" subtitle="Cost of Goods Sold tracking via Shopify metafield (finance.cogs)" />

      {/* CSV Import Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import COGS via CSV
          </CardTitle>
          <CardDescription>
            Upload a CSV with columns: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">SKU, COGS</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="writeToShopify"
              checked={writeToShopify}
              onCheckedChange={(v) => setWriteToShopify(v === true)}
            />
            <Label htmlFor="writeToShopify" className="text-sm cursor-pointer">
              Also write COGS to Shopify metafield (finance.cogs)
            </Label>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild className="relative">
              <label className="cursor-pointer">
                {uploading ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Uploading...</>
                ) : (
                  <><FileText className="h-3.5 w-3.5 mr-1" /> Choose CSV File</>
                )}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="sr-only"
                />
              </label>
            </Button>
          </div>

          {uploadResult && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{uploadResult.success} updated</span>
                </div>
                {uploadResult.errors > 0 && (
                  <div className="flex items-center gap-1.5 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{uploadResult.errors} errors</span>
                  </div>
                )}
                <span className="text-muted-foreground">of {uploadResult.total} total</span>
              </div>
              {uploadResult.results.filter((r) => r.status === "error").length > 0 && (
                <div className="space-y-1 mt-2">
                  {uploadResult.results
                    .filter((r) => r.status === "error")
                    .slice(0, 10)
                    .map((r, i) => (
                      <p key={i} className="text-xs text-destructive">
                        SKU &quot;{r.sku}&quot;: {r.error}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary badges + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search SKU or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Badge variant="outline">{withCogsCount} with COGS</Badge>
        {withoutCogsCount > 0 && (
          <Badge variant="secondary">{withoutCogsCount} missing COGS</Badge>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <DataTableSkeleton columns={5} rows={10} />
      ) : variants.length === 0 ? (
        <Card>
          <CardContent className="py-0">
            <EmptyState
              icon={<DollarSign className="h-6 w-6 text-muted-foreground" />}
              title="No variants found"
              description="Sync your Shopify data first or adjust your search."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm sticky-header">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="p-3 text-left font-medium">SKU</th>
                  <th className="p-3 text-left font-medium">Product / Variant</th>
                  <th className="p-3 text-right font-medium">COGS</th>
                  <th className="p-3 text-left font-medium">Source</th>
                  <th className="p-3 text-left font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{v.sku || "-"}</td>
                    <td className="p-3 text-muted-foreground truncate max-w-[250px]">
                      {v.productTitle}
                      {v.title && v.title !== "Default Title" ? ` / ${v.title}` : ""}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {v.cogs !== null ? (
                        <span className="font-medium">${v.cogs.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </td>
                    <td className="p-3">
                      {v.cogsSource ? (
                        <StatusChip variant={v.cogsSource === "csv" ? "info" : "neutral"}>{v.cogsSource}</StatusChip>
                      ) : "-"}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {v.cogsUpdatedAt ? new Date(v.cogsUpdatedAt).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CogsPage() {
  return (
    <AppShell>
      <CogsContent />
    </AppShell>
  );
}
