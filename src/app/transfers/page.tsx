"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import EmptyState from "@/components/EmptyState";
import DataTableSkeleton from "@/components/DataTableSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Download, Search, Brain, ArrowRightLeft, Package,
  CheckCircle2, Truck, PackageCheck, X,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

interface Transfer {
  id: string; sku: string; title: string; productTitle: string; vendor: string;
  destinationName: string; destinationLocationId: string;
  warehouseOnHand: number; destOnHand: number; avgDailySales30: number;
  daysOfCover: number; targetOnHand: number; transferQty: number;
  stockoutRisk: boolean; capitalTied: number | null; priority: number; status: string;
}

interface Location { id: string; name: string; }

function TransfersContent() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterLocation, setFilterLocation] = useState("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [useAiPriority, setUseAiPriority] = useState(false);
  const [aiTransfers, setAiTransfers] = useState<Array<{ sku: string; variant_id: string; priority: number; qty: number }>>([]);
  const [hasAiData, setHasAiData] = useState(false);
  const [drawerTransfer, setDrawerTransfer] = useState<Transfer | null>(null);
  const { t } = useI18n();

  function getPriorityChip(daysOfCover: number, stockoutRisk: boolean) {
    if (stockoutRisk || daysOfCover < 3) return <StatusChip variant="critical">{t("transfers.critical")}</StatusChip>;
    if (daysOfCover < 7) return <StatusChip variant="warning">{t("transfers.high")}</StatusChip>;
    if (daysOfCover < 14) return <StatusChip variant="info">{t("transfers.medium")}</StatusChip>;
    return <StatusChip variant="neutral">{t("transfers.lowPriority")}</StatusChip>;
  }

  function getStatusChip(status: string) {
    switch (status) {
      case "picked": return <StatusChip variant="info">{t("transfers.picked")}</StatusChip>;
      case "shipped": return <StatusChip variant="purple">{t("transfers.shipped")}</StatusChip>;
      case "received": return <StatusChip variant="success">{t("transfers.received")}</StatusChip>;
      default: return <StatusChip variant="neutral">{t("transfers.pending")}</StatusChip>;
    }
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterLocation && filterLocation !== "all") params.set("locationId", filterLocation);
    if (searchDebounced) params.set("search", searchDebounced);

    try {
      const res = await fetch(`/api/transfers?${params}`);
      const data = await res.json();
      setTransfers(data.transfers || []);
      setLocations(data.locations || []);
    } catch {
      toast.error(t("transfers.failedLoad"));
    } finally {
      setLoading(false);
    }

    try {
      const aiRes = await fetch("/api/ai-insights");
      const aiData = await aiRes.json();
      if (aiData.insights?.prioritized_transfers?.length > 0) {
        setAiTransfers(aiData.insights.prioritized_transfers);
        setHasAiData(true);
      }
    } catch {}
  }, [filterLocation, searchDebounced, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusUpdate = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      await fetch("/api/transfers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      toast.success(`${selectedIds.size} ${t("transfers.markedAs")} ${status}`);
      setSelectedIds(new Set());
      fetchData();
    } catch {
      toast.error(t("transfers.failedUpdate"));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === displayTransfers.length)
      setSelectedIds(new Set());
    else
      setSelectedIds(new Set(displayTransfers.map((tr) => tr.id)));
  };

  const displayTransfers = useMemo(() => {
    if (!useAiPriority || !hasAiData) return transfers;
    return [...transfers].sort((a, b) => {
      const aiA = aiTransfers.find((ai) => ai.sku === a.sku);
      const aiB = aiTransfers.find((ai) => ai.sku === b.sku);
      return (aiB?.priority ?? 0) - (aiA?.priority ?? 0);
    });
  }, [transfers, useAiPriority, hasAiData, aiTransfers]);

  const getAiQty = (sku: string) => {
    if (!useAiPriority || !hasAiData) return null;
    return aiTransfers.find((ai) => ai.sku === sku)?.qty ?? null;
  };

  if (loading) return <DataTableSkeleton columns={8} rows={10} />;

  return (
    <div className="space-y-4">
      <PageHeader title={t("transfers.title")} subtitle={t("transfers.subtitle")}>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <Badge variant="secondary">{selectedIds.size} {t("transfers.selected")}</Badge>
              <Button size="sm" variant="outline" onClick={() => handleStatusUpdate("picked")}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t("transfers.picked")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStatusUpdate("shipped")}>
                <Truck className="h-3.5 w-3.5 mr-1" /> {t("transfers.shipped")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStatusUpdate("received")}>
                <PackageCheck className="h-3.5 w-3.5 mr-1" /> {t("transfers.received")}
              </Button>
              <Separator orientation="vertical" className="h-6" />
            </>
          )}
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/transfers/csv${filterLocation && filterLocation !== "all" ? `?locationId=${filterLocation}` : ""}`}>
              <Download className="h-3.5 w-3.5 mr-1" /> {t("transfers.exportCsv")}
            </a>
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("transfers.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder={t("transfers.allDestinations")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("transfers.allDestinations")}</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasAiData && (
          <Button
            size="sm"
            variant={useAiPriority ? "default" : "outline"}
            onClick={() => setUseAiPriority(!useAiPriority)}
            className="h-9"
          >
            <Brain className="h-3.5 w-3.5 mr-1" />
            {t("transfers.aiPriority")}
          </Button>
        )}
      </div>

      {/* Table */}
      {displayTransfers.length === 0 ? (
        <Card>
          <CardContent className="py-0">
            <EmptyState
              icon={<ArrowRightLeft className="h-6 w-6 text-muted-foreground" />}
              title={t("transfers.noRecommendations")}
              description={t("transfers.allSufficient")}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm sticky-header">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="p-3 w-10">
                    <Checkbox
                      checked={selectedIds.size === displayTransfers.length && displayTransfers.length > 0}
                      onCheckedChange={selectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3 text-left font-medium">{t("transfers.sku")}</th>
                  <th className="p-3 text-left font-medium">{t("transfers.product")}</th>
                  <th className="p-3 text-left font-medium">{t("transfers.destination")}</th>
                  <th className="p-3 text-right font-medium">{t("transfers.whStock")}</th>
                  <th className="p-3 text-right font-medium">{t("transfers.destStock")}</th>
                  <th className="p-3 text-right font-medium">{t("transfers.avgDay")}</th>
                  <th className="p-3 text-center font-medium">{t("transfers.cover")}</th>
                  <th className="p-3 text-right font-medium">{t("transfers.transferQty")}</th>
                  {useAiPriority && <th className="p-3 text-right font-medium">{t("transfers.aiQty")}</th>}
                  <th className="p-3 text-center font-medium">{t("transfers.priority")}</th>
                  <th className="p-3 text-center font-medium">{t("transfers.status")}</th>
                </tr>
              </thead>
              <tbody>
                {displayTransfers.map((tr) => (
                  <tr
                    key={tr.id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                      setDrawerTransfer(tr);
                    }}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(tr.id)}
                        onCheckedChange={() => toggleSelect(tr.id)}
                        aria-label={`Select ${tr.sku}`}
                      />
                    </td>
                    <td className="p-3 font-medium">{tr.sku || "-"}</td>
                    <td className="p-3 text-muted-foreground truncate max-w-[200px]">
                      {tr.productTitle}{tr.title && tr.title !== "Default Title" ? ` / ${tr.title}` : ""}
                    </td>
                    <td className="p-3">{tr.destinationName}</td>
                    <td className="p-3 text-right tabular-nums">{tr.warehouseOnHand}</td>
                    <td className="p-3 text-right tabular-nums">{tr.destOnHand}</td>
                    <td className="p-3 text-right tabular-nums">{tr.avgDailySales30?.toFixed(1)}</td>
                    <td className="p-3 text-center">
                      <StatusChip variant={tr.daysOfCover < 5 ? "critical" : tr.daysOfCover < 15 ? "warning" : "success"}>
                        {tr.daysOfCover?.toFixed(0)}d
                      </StatusChip>
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-bold text-primary tabular-nums">{tr.transferQty}</span>
                    </td>
                    {useAiPriority && (
                      <td className="p-3 text-right tabular-nums">
                        {getAiQty(tr.sku) !== null ? (
                          <span className="font-medium text-purple-700">{getAiQty(tr.sku)}</span>
                        ) : "-"}
                      </td>
                    )}
                    <td className="p-3 text-center">{getPriorityChip(tr.daysOfCover, tr.stockoutRisk)}</td>
                    <td className="p-3 text-center">{getStatusChip(tr.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <Sheet open={!!drawerTransfer} onOpenChange={(open) => !open && setDrawerTransfer(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {drawerTransfer && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  {drawerTransfer.sku || drawerTransfer.title}
                </SheetTitle>
                <SheetDescription>
                  {drawerTransfer.productTitle}
                  {drawerTransfer.title && drawerTransfer.title !== "Default Title" ? ` / ${drawerTransfer.title}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Priority & Status */}
                <div className="flex items-center gap-3">
                  {getPriorityChip(drawerTransfer.daysOfCover, drawerTransfer.stockoutRisk)}
                  {getStatusChip(drawerTransfer.status)}
                  {drawerTransfer.vendor && (
                    <Badge variant="outline">{drawerTransfer.vendor}</Badge>
                  )}
                </div>

                {/* Transfer Details */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("transfers.transferDetails")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("transfers.destination")}</span>
                      <span className="font-medium">{drawerTransfer.destinationName}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("transfers.recommendedQty")}</span>
                      <span className="font-bold text-primary text-lg">{drawerTransfer.transferQty}</span>
                    </div>
                    {useAiPriority && getAiQty(drawerTransfer.sku) !== null && (
                      <>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("transfers.aiSuggestedQty")}</span>
                          <span className="font-medium text-purple-700">{getAiQty(drawerTransfer.sku)}</span>
                        </div>
                      </>
                    )}
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("transfers.targetOnHand")}</span>
                      <span>{drawerTransfer.targetOnHand}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Inventory Metrics */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t("transfers.inventoryMetrics")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("transfers.warehouseOnHand")}</span>
                      <span className="font-medium">{drawerTransfer.warehouseOnHand}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("transfers.destinationOnHand")}</span>
                      <span className="font-medium">{drawerTransfer.destOnHand}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("transfers.avgDailySales30")}</span>
                      <span>{drawerTransfer.avgDailySales30?.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("transfers.daysOfCover")}</span>
                      <StatusChip variant={drawerTransfer.daysOfCover < 5 ? "critical" : drawerTransfer.daysOfCover < 15 ? "warning" : "success"}>
                        {drawerTransfer.daysOfCover?.toFixed(1)}d
                      </StatusChip>
                    </div>
                    {drawerTransfer.capitalTied !== null && (
                      <>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("transfers.capitalTied")}</span>
                          <span>${drawerTransfer.capitalTied?.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSelectedIds((prev) => new Set(prev).add(drawerTransfer.id));
                      setDrawerTransfer(null);
                      toast.info(t("transfers.addedToSelection"));
                    }}
                  >
                    {t("transfers.addToPlan")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      handleStatusUpdate("received");
                      setDrawerTransfer(null);
                    }}
                  >
                    {t("transfers.markReceived")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function TransfersPage() {
  return (
    <AppShell>
      <TransfersContent />
    </AppShell>
  );
}
