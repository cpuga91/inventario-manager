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

interface Transfer {
  id: string; sku: string; title: string; productTitle: string; vendor: string;
  destinationName: string; destinationLocationId: string;
  warehouseOnHand: number; destOnHand: number; avgDailySales30: number;
  daysOfCover: number; targetOnHand: number; transferQty: number;
  stockoutRisk: boolean; capitalTied: number | null; priority: number; status: string;
}

interface Location { id: string; name: string; }

function getPriorityChip(daysOfCover: number, stockoutRisk: boolean) {
  if (stockoutRisk || daysOfCover < 3) return <StatusChip variant="critical">Critical</StatusChip>;
  if (daysOfCover < 7) return <StatusChip variant="warning">High</StatusChip>;
  if (daysOfCover < 14) return <StatusChip variant="info">Medium</StatusChip>;
  return <StatusChip variant="neutral">Low</StatusChip>;
}

function getStatusChip(status: string) {
  switch (status) {
    case "picked": return <StatusChip variant="info">Picked</StatusChip>;
    case "shipped": return <StatusChip variant="purple">Shipped</StatusChip>;
    case "received": return <StatusChip variant="success">Received</StatusChip>;
    default: return <StatusChip variant="neutral">Pending</StatusChip>;
  }
}

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

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
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
      toast.error("Failed to load transfers");
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
  }, [filterLocation, searchDebounced]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusUpdate = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      await fetch("/api/transfers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      toast.success(`${selectedIds.size} transfer(s) marked as ${status}`);
      setSelectedIds(new Set());
      fetchData();
    } catch {
      toast.error("Failed to update status");
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
      setSelectedIds(new Set(displayTransfers.map((t) => t.id)));
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
      <PageHeader title="Transfers" subtitle="Transfer recommendations from warehouse to destinations">
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <Badge variant="secondary">{selectedIds.size} selected</Badge>
              <Button size="sm" variant="outline" onClick={() => handleStatusUpdate("picked")}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Picked
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStatusUpdate("shipped")}>
                <Truck className="h-3.5 w-3.5 mr-1" /> Shipped
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStatusUpdate("received")}>
                <PackageCheck className="h-3.5 w-3.5 mr-1" /> Received
              </Button>
              <Separator orientation="vertical" className="h-6" />
            </>
          )}
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/transfers/csv${filterLocation && filterLocation !== "all" ? `?locationId=${filterLocation}` : ""}`}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </a>
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
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
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="All Destinations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Destinations</SelectItem>
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
            AI Priority
          </Button>
        )}
      </div>

      {/* Table */}
      {displayTransfers.length === 0 ? (
        <Card>
          <CardContent className="py-0">
            <EmptyState
              icon={<ArrowRightLeft className="h-6 w-6 text-muted-foreground" />}
              title="No transfer recommendations"
              description="All destinations have sufficient inventory coverage."
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
                  <th className="p-3 text-left font-medium">SKU</th>
                  <th className="p-3 text-left font-medium">Product</th>
                  <th className="p-3 text-left font-medium">Destination</th>
                  <th className="p-3 text-right font-medium">WH Stock</th>
                  <th className="p-3 text-right font-medium">Dest Stock</th>
                  <th className="p-3 text-right font-medium">Avg/day</th>
                  <th className="p-3 text-center font-medium">Cover</th>
                  <th className="p-3 text-right font-medium">Transfer Qty</th>
                  {useAiPriority && <th className="p-3 text-right font-medium">AI Qty</th>}
                  <th className="p-3 text-center font-medium">Priority</th>
                  <th className="p-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayTransfers.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                      setDrawerTransfer(t);
                    }}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(t.id)}
                        onCheckedChange={() => toggleSelect(t.id)}
                        aria-label={`Select ${t.sku}`}
                      />
                    </td>
                    <td className="p-3 font-medium">{t.sku || "-"}</td>
                    <td className="p-3 text-muted-foreground truncate max-w-[200px]">
                      {t.productTitle}{t.title && t.title !== "Default Title" ? ` / ${t.title}` : ""}
                    </td>
                    <td className="p-3">{t.destinationName}</td>
                    <td className="p-3 text-right tabular-nums">{t.warehouseOnHand}</td>
                    <td className="p-3 text-right tabular-nums">{t.destOnHand}</td>
                    <td className="p-3 text-right tabular-nums">{t.avgDailySales30?.toFixed(1)}</td>
                    <td className="p-3 text-center">
                      <StatusChip variant={t.daysOfCover < 5 ? "critical" : t.daysOfCover < 15 ? "warning" : "success"}>
                        {t.daysOfCover?.toFixed(0)}d
                      </StatusChip>
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-bold text-primary tabular-nums">{t.transferQty}</span>
                    </td>
                    {useAiPriority && (
                      <td className="p-3 text-right tabular-nums">
                        {getAiQty(t.sku) !== null ? (
                          <span className="font-medium text-purple-700">{getAiQty(t.sku)}</span>
                        ) : "-"}
                      </td>
                    )}
                    <td className="p-3 text-center">{getPriorityChip(t.daysOfCover, t.stockoutRisk)}</td>
                    <td className="p-3 text-center">{getStatusChip(t.status)}</td>
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
                    <CardTitle className="text-sm">Transfer Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Destination</span>
                      <span className="font-medium">{drawerTransfer.destinationName}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Recommended Qty</span>
                      <span className="font-bold text-primary text-lg">{drawerTransfer.transferQty}</span>
                    </div>
                    {useAiPriority && getAiQty(drawerTransfer.sku) !== null && (
                      <>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">AI Suggested Qty</span>
                          <span className="font-medium text-purple-700">{getAiQty(drawerTransfer.sku)}</span>
                        </div>
                      </>
                    )}
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Target On-Hand</span>
                      <span>{drawerTransfer.targetOnHand}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Inventory Metrics */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Inventory Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Warehouse On-Hand</span>
                      <span className="font-medium">{drawerTransfer.warehouseOnHand}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Destination On-Hand</span>
                      <span className="font-medium">{drawerTransfer.destOnHand}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Daily Sales (30d)</span>
                      <span>{drawerTransfer.avgDailySales30?.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days of Cover</span>
                      <StatusChip variant={drawerTransfer.daysOfCover < 5 ? "critical" : drawerTransfer.daysOfCover < 15 ? "warning" : "success"}>
                        {drawerTransfer.daysOfCover?.toFixed(1)}d
                      </StatusChip>
                    </div>
                    {drawerTransfer.capitalTied !== null && (
                      <>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Capital Tied</span>
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
                      toast.info("Added to selection");
                    }}
                  >
                    Add to Plan
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
                    Mark Received
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
