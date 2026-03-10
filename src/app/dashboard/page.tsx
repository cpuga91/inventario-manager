"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import StatusChip from "@/components/StatusChip";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, TrendingDown, PackageX, Warehouse,
  ArrowRightLeft, Tag, ExternalLink, Clock,
} from "lucide-react";

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

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    </div>
  );
}

function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <EmptyState title={t("dash.noData")} description={t("dash.runWizard")} />;

  const stockoutCount = data.stockoutRisks.length;
  const overstockCount = data.overstockRisks.length;
  const deadStockCount = data.overstockRisks.filter((r) => r.discountBucket >= 30).length;
  const reorderCount = data.reorderFlags.length;
  const warehouseOk = reorderCount === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t("dash.title")} subtitle={t("dash.subtitle")}>
        <Button variant="outline" size="sm" asChild>
          <Link href="/transfers">{t("dash.viewAllTransfers")}</Link>
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={t("dash.stockoutRisks")} value={stockoutCount}
          subtitle={stockoutCount > 0 ? t("dash.needTransfers") : t("dash.allClear")}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={stockoutCount > 0 ? "danger" : "success"} />
        <KpiCard title={t("dash.overstockItems")} value={overstockCount}
          subtitle={overstockCount > 0 ? t("dash.reviewDiscounts") : t("dash.allClear")}
          icon={<TrendingDown className="h-4 w-4" />}
          variant={overstockCount > 0 ? "warning" : "success"} />
        <KpiCard title={t("dash.deadStock")} value={deadStockCount}
          subtitle={deadStockCount > 0 ? t("dash.noRecentSales") : t("dash.allClear")}
          icon={<PackageX className="h-4 w-4" />}
          variant={deadStockCount > 0 ? "danger" : "success"} />
        <KpiCard title={t("dash.warehouseStatus")} value={warehouseOk ? t("dash.healthy") : `${reorderCount} ${t("dash.low")}`}
          subtitle={`${data.warehouseHealth?.totalOnHand ?? 0} ${t("dash.unitsOnHand")}`}
          icon={<Warehouse className="h-4 w-4" />}
          variant={warehouseOk ? "success" : "warning"} />
      </div>

      {/* Urgent Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
                {t("dash.urgentTransfers")}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/transfers" className="text-xs">{t("dash.viewAll")} <ExternalLink className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {data.stockoutRisks.length === 0 ? (
              <EmptyState title={t("dash.noUrgentTransfers")} description={t("dash.allDestSufficient")} />
            ) : (
              <div className="divide-y">
                {data.stockoutRisks.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.sku || r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.destinationName}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <StatusChip variant={r.daysOfCover < 5 ? "critical" : "warning"}>
                        {r.daysOfCover?.toFixed(0)}{t("dash.dCover")}
                      </StatusChip>
                      <span className="text-sm font-semibold text-primary w-12 text-right">+{r.transferQty}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4 text-amber-600" />
                {t("dash.discountCandidates")}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/discounts" className="text-xs">{t("dash.viewAll")} <ExternalLink className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {data.overstockRisks.length === 0 ? (
              <EmptyState title={t("dash.noDiscountCandidates")} description={t("dash.noOverstockDetected")} />
            ) : (
              <div className="divide-y">
                {data.overstockRisks.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.sku || r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.locationName}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-xs text-muted-foreground">
                        {r.capitalTied !== null ? `$${r.capitalTied.toFixed(0)}` : ""}
                      </span>
                      <StatusChip variant={r.discountBucket >= 30 ? "critical" : "warning"}>
                        {r.discountBucket}% {t("dash.off")}
                      </StatusChip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Warehouse Reorder + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-blue-600" />
              {t("dash.warehouseReorder")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.reorderFlags.length === 0 ? (
              <EmptyState title={t("dash.warehouseHealthy")} description={t("dash.noBelowThreshold")} />
            ) : (
              <div className="divide-y">
                {data.reorderFlags.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5">
                    <p className="text-sm font-medium truncate flex-1 min-w-0">{r.sku || r.title}</p>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-xs text-muted-foreground">{r.warehouseOnHand} {t("dash.onHand")}</span>
                      <StatusChip variant="info">{r.warehouseDaysOfCover?.toFixed(0)}{t("dash.dCover")}</StatusChip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {t("dash.recentAlerts")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.alerts.length === 0 ? (
              <EmptyState title={t("dash.noAlerts")} description={t("dash.smoothly")} />
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.alerts.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 rounded-md px-3 py-2 text-sm bg-muted/50">
                    <StatusChip variant={a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "neutral"}>
                      {a.severity}
                    </StatusChip>
                    <span className="text-sm leading-5">{a.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
