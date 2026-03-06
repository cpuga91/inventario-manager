"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import EmptyState from "@/components/EmptyState";
import DataTableSkeleton from "@/components/DataTableSkeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tag, PackageX, TrendingDown, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";

interface Discount {
  id: string; sku: string; title: string; productTitle: string; locationName: string;
  onHand: number; daysOfCover: number; daysSinceLastSale: number | null;
  capitalTied: number | null; discountBucket: number; rationale: string;
  status: string; reviewedAt: string | null;
}

function DiscountsContent() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerDiscount, setDrawerDiscount] = useState<Discount | null>(null);

  useEffect(() => {
    fetch("/api/discounts")
      .then((r) => r.json())
      .then((data) => setDiscounts(data.discounts || []))
      .catch(() => toast.error("Failed to load discounts"))
      .finally(() => setLoading(false));
  }, []);

  const markReviewed = async (ids: string[]) => {
    try {
      await fetch("/api/discounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status: "reviewed" }),
      });
      setDiscounts((prev) =>
        prev.map((d) => (ids.includes(d.id) ? { ...d, status: "reviewed", reviewedAt: new Date().toISOString() } : d))
      );
      setSelectedIds(new Set());
      toast.success(`${ids.length} item(s) marked as reviewed`);
    } catch {
      toast.error("Failed to update");
    }
  };

  if (loading) return <DataTableSkeleton columns={7} rows={8} />;

  const deadStock = discounts.filter((d) => d.discountBucket >= 30 && d.status !== "reviewed");
  const overstock = discounts.filter((d) => d.discountBucket < 30 && d.status !== "reviewed");
  const reviewed = discounts.filter((d) => d.status === "reviewed");

  const renderTable = (items: Discount[]) => {
    if (items.length === 0) {
      return (
        <EmptyState
          icon={<Tag className="h-6 w-6 text-muted-foreground" />}
          title="No items"
          description="No discount recommendations in this category."
        />
      );
    }

    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sticky-header">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground">
                <th className="p-3 w-10">
                  <Checkbox
                    checked={items.every((i) => selectedIds.has(i.id)) && items.length > 0}
                    onCheckedChange={() => {
                      const allSelected = items.every((i) => selectedIds.has(i.id));
                      if (allSelected) {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          items.forEach((i) => next.delete(i.id));
                          return next;
                        });
                      } else {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          items.forEach((i) => next.add(i.id));
                          return next;
                        });
                      }
                    }}
                    aria-label="Select all"
                  />
                </th>
                <th className="p-3 text-left font-medium">SKU</th>
                <th className="p-3 text-left font-medium">Location</th>
                <th className="p-3 text-right font-medium">On Hand</th>
                <th className="p-3 text-center font-medium">Cover</th>
                <th className="p-3 text-right font-medium">Days No Sale</th>
                <th className="p-3 text-right font-medium">Capital</th>
                <th className="p-3 text-center font-medium">Discount</th>
                <th className="p-3 text-center font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr
                  key={d.id}
                  className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("input, button")) return;
                    setDrawerDiscount(d);
                  }}
                >
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(d.id)}
                      onCheckedChange={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
                          return next;
                        });
                      }}
                      aria-label={`Select ${d.sku}`}
                    />
                  </td>
                  <td className="p-3">
                    <span className="font-medium">{d.sku || "-"}</span>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">{d.productTitle}</p>
                  </td>
                  <td className="p-3">{d.locationName}</td>
                  <td className="p-3 text-right tabular-nums">{d.onHand}</td>
                  <td className="p-3 text-center">{d.daysOfCover?.toFixed(0)}d</td>
                  <td className="p-3 text-right tabular-nums">{d.daysSinceLastSale ?? "N/A"}</td>
                  <td className="p-3 text-right tabular-nums">{d.capitalTied !== null ? `$${d.capitalTied.toFixed(0)}` : "-"}</td>
                  <td className="p-3 text-center">
                    <StatusChip variant={d.discountBucket >= 30 ? "critical" : d.discountBucket >= 20 ? "warning" : "info"}>
                      {d.discountBucket}% off
                    </StatusChip>
                  </td>
                  <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {d.status === "reviewed" ? (
                      <StatusChip variant="success">Reviewed</StatusChip>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => markReviewed([d.id])} className="h-7 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Review
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Discounts" subtitle="Overstock and dead stock items that need markdown action">
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
            <Button size="sm" onClick={() => markReviewed(Array.from(selectedIds))}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Reviewed
            </Button>
          </div>
        )}
      </PageHeader>

      <Tabs defaultValue="deadstock">
        <TabsList>
          <TabsTrigger value="deadstock" className="gap-1.5">
            <PackageX className="h-3.5 w-3.5" />
            Dead Stock
            {deadStock.length > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{deadStock.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="overstock" className="gap-1.5">
            <TrendingDown className="h-3.5 w-3.5" />
            Overstock
            {overstock.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{overstock.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Reviewed
            <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px]">{reviewed.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deadstock" className="mt-4">{renderTable(deadStock)}</TabsContent>
        <TabsContent value="overstock" className="mt-4">{renderTable(overstock)}</TabsContent>
        <TabsContent value="reviewed" className="mt-4">{renderTable(reviewed)}</TabsContent>
      </Tabs>

      {/* Detail Drawer */}
      <Sheet open={!!drawerDiscount} onOpenChange={(open) => !open && setDrawerDiscount(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {drawerDiscount && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-amber-600" />
                  {drawerDiscount.sku || drawerDiscount.title}
                </SheetTitle>
                <SheetDescription>{drawerDiscount.productTitle}</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                <div className="flex items-center gap-2">
                  <StatusChip variant={drawerDiscount.discountBucket >= 30 ? "critical" : "warning"}>
                    {drawerDiscount.discountBucket}% off
                  </StatusChip>
                  {drawerDiscount.status === "reviewed" && <StatusChip variant="success">Reviewed</StatusChip>}
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Location</span>
                      <span className="font-medium">{drawerDiscount.locationName}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">On Hand</span>
                      <span className="font-medium">{drawerDiscount.onHand}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days of Cover</span>
                      <span>{drawerDiscount.daysOfCover?.toFixed(0)}d</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days Without Sale</span>
                      <span>{drawerDiscount.daysSinceLastSale ?? "N/A"}</span>
                    </div>
                    {drawerDiscount.capitalTied !== null && (
                      <>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Capital Tied</span>
                          <span className="font-medium">${drawerDiscount.capitalTied?.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5" /> Rationale
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{drawerDiscount.rationale}</p>
                  </CardContent>
                </Card>

                {drawerDiscount.status !== "reviewed" && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      markReviewed([drawerDiscount.id]);
                      setDrawerDiscount(null);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Reviewed
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function DiscountsPage() {
  return (
    <AppShell>
      <DiscountsContent />
    </AppShell>
  );
}
