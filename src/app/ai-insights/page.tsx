"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import StatusChip from "@/components/StatusChip";
import EmptyState from "@/components/EmptyState";
import DataTableSkeleton from "@/components/DataTableSkeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, Play, CheckCircle2, AlertTriangle, TrendingDown,
  Loader2, ChevronDown, ChevronRight, Lightbulb, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

interface AiRun {
  id: string; runDate: string; status: "SUCCESS" | "FAILED"; model: string;
  promptVersion?: string; tokensIn: number | null; tokensOut: number | null;
  errorMessage: string | null; reviewed: boolean; createdAt: string;
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

function AiInsightsContent() {
  const [run, setRun] = useState<AiRun | null>(null);
  const [insights, setInsights] = useState<AiInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [anomaliesOpen, setAnomaliesOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const { t } = useI18n();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-insights");
      const data = await res.json();
      setRun(data.run);
      setInsights(data.insights);
    } catch {
      toast.error(t("ai.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const triggerRun = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/ai-insights", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setRun(data.run);
        setInsights(data.insights);
        toast.success(t("ai.analysisComplete"));
      }
    } catch {
      toast.error(t("ai.failedRun"));
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
    toast.success(t("ai.markedReviewed"));
  };

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("ai.title")} subtitle={t("ai.subtitle")}>
        <div className="flex items-center gap-2">
          {run && !run.reviewed && run.status === "SUCCESS" && (
            <Button size="sm" variant="outline" onClick={markReviewed}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t("ai.markReviewed")}
            </Button>
          )}
          <Button size="sm" onClick={triggerRun} disabled={running}>
            {running ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> {t("ai.running")}</>
            ) : (
              <><Play className="h-3.5 w-3.5 mr-1" /> {t("ai.runAnalysis")}</>
            )}
          </Button>
        </div>
      </PageHeader>

      {/* Run Status */}
      {run && (
        <Card className={run.status === "SUCCESS" ? "border-emerald-200" : "border-red-200"}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusChip variant={run.status === "SUCCESS" ? "success" : "critical"}>
                  {run.status}
                </StatusChip>
                <span className="text-sm">
                  {t("ai.lastRun")} {new Date(run.createdAt).toLocaleString()}
                </span>
                {run.reviewed && <Badge variant="outline" className="text-xs">{t("discounts.reviewed")}</Badge>}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{t("ai.model")}: {run.model}</span>
                <span>{t("ai.tokens")} {run.tokensIn ?? 0} {t("ai.in")} / {run.tokensOut ?? 0} {t("ai.out")}</span>
              </div>
            </div>
            {run.errorMessage && (
              <p className="text-sm text-destructive mt-2">{run.errorMessage}</p>
            )}
          </CardContent>
        </Card>
      )}

      {!run && (
        <Card>
          <CardContent className="py-0">
            <EmptyState
              icon={<Brain className="h-6 w-6 text-muted-foreground" />}
              title={t("ai.noRuns")}
              description={t("ai.noRunsDesc")}
              action={{ label: t("ai.runAnalysis"), onClick: triggerRun }}
            />
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {insights && run?.status === "SUCCESS" && (
        <div className="space-y-6">
          {/* Headline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                {t("ai.todayHeadline")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-lg font-medium">{insights.summary.headline}</p>
              {insights.summary.top_risk_locations.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("ai.topRiskLocations")}</p>
                  {insights.summary.top_risk_locations.map((loc, i) => (
                    <div key={i} className="flex items-start gap-2 bg-red-50 rounded-md px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-sm font-medium text-red-800">{loc.location}</span>
                        <span className="text-sm text-red-700 ml-1">— {loc.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {insights.summary.notes.length > 0 && (
                <div className="mt-4 space-y-1">
                  {insights.summary.notes.map((note, i) => (
                    <p key={i} className="text-sm text-muted-foreground">• {note}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prioritized Transfers */}
          {insights.prioritized_transfers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("ai.prioritizedTransfers")}
                  <Badge variant="secondary" className="ml-2">{insights.prioritized_transfers.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm sticky-header">
                      <thead>
                        <tr className="border-b bg-muted/50 text-muted-foreground">
                          <th className="p-3 text-center font-medium">{t("transfers.priority")}</th>
                          <th className="p-3 text-left font-medium">{t("transfers.sku")}</th>
                          <th className="p-3 text-left font-medium">{t("ai.to")}</th>
                          <th className="p-3 text-right font-medium">{t("ai.qty")}</th>
                          <th className="p-3 text-center font-medium">{t("ai.confidence")}</th>
                          <th className="p-3 text-center font-medium">{t("transfers.cover")}</th>
                          <th className="p-3 text-left font-medium">{t("discounts.rationale")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.prioritized_transfers.map((tr, i) => (
                          <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-3 text-center">
                              <StatusChip variant={tr.priority >= 70 ? "critical" : tr.priority >= 40 ? "warning" : "success"}>
                                {tr.priority}
                              </StatusChip>
                            </td>
                            <td className="p-3 font-medium">{tr.sku}</td>
                            <td className="p-3">{tr.to_location}</td>
                            <td className="p-3 text-right font-bold text-primary tabular-nums">{tr.qty}</td>
                            <td className="p-3 text-center">
                              <Badge variant="outline">{(tr.confidence * 100).toFixed(0)}%</Badge>
                            </td>
                            <td className="p-3 text-center">{tr.evidence.days_of_cover.toFixed(0)}d</td>
                            <td className="p-3 text-muted-foreground truncate max-w-[200px]">{tr.rationale}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Discount Actions */}
          {insights.discount_actions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t("ai.discountSuggestions")}
                  <Badge variant="secondary" className="ml-2">{insights.discount_actions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm sticky-header">
                      <thead>
                        <tr className="border-b bg-muted/50 text-muted-foreground">
                          <th className="p-3 text-left font-medium">{t("transfers.sku")}</th>
                          <th className="p-3 text-left font-medium">{t("discounts.location")}</th>
                          <th className="p-3 text-center font-medium">{t("discounts.discount")}</th>
                          <th className="p-3 text-center font-medium">{t("ai.confidence")}</th>
                          <th className="p-3 text-right font-medium">{t("discounts.onHand")}</th>
                          <th className="p-3 text-center font-medium">{t("transfers.cover")}</th>
                          <th className="p-3 text-left font-medium">{t("discounts.rationale")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.discount_actions.map((d, i) => (
                          <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-medium">{d.sku}</td>
                            <td className="p-3">{d.location}</td>
                            <td className="p-3 text-center">
                              <StatusChip variant={d.discount_pct >= 30 ? "critical" : d.discount_pct >= 20 ? "warning" : "info"}>
                                {d.discount_pct}%
                              </StatusChip>
                            </td>
                            <td className="p-3 text-center">
                              <Badge variant="outline">{(d.confidence * 100).toFixed(0)}%</Badge>
                            </td>
                            <td className="p-3 text-right tabular-nums">{d.evidence.on_hand}</td>
                            <td className="p-3 text-center">{d.evidence.days_of_cover.toFixed(0)}d</td>
                            <td className="p-3 text-muted-foreground truncate max-w-[200px]">{d.rationale}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Anomalies (collapsible) */}
          {insights.anomalies.length > 0 && (
            <Card>
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setAnomaliesOpen(!anomaliesOpen)}>
                <CardTitle className="text-base flex items-center gap-2">
                  {anomaliesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Activity className="h-4 w-4 text-amber-600" />
                  {t("ai.anomalies")}
                  <Badge variant="secondary">{insights.anomalies.length}</Badge>
                </CardTitle>
              </CardHeader>
              {anomaliesOpen && (
                <CardContent className="pt-0 space-y-3">
                  {insights.anomalies.map((a, i) => (
                    <div key={i} className="rounded-md border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusChip variant="warning">{a.type.replace(/_/g, " ")}</StatusChip>
                        <span className="text-sm font-medium">{a.sku}</span>
                        <span className="text-xs text-muted-foreground">{t("ai.at")} {a.location}</span>
                        <Badge variant="outline" className="text-xs ml-auto">{(a.confidence * 100).toFixed(0)}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{a.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {a.evidence.metric}: {a.evidence.value} ({t("ai.baseline")}: {a.evidence.baseline})
                      </p>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* Parameter Suggestions (collapsible) */}
          {insights.parameter_suggestions.length > 0 && (
            <Card>
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setParamsOpen(!paramsOpen)}>
                <CardTitle className="text-base flex items-center gap-2">
                  {paramsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Lightbulb className="h-4 w-4 text-blue-600" />
                  {t("ai.paramSuggestions")}
                  <Badge variant="secondary">{insights.parameter_suggestions.length}</Badge>
                </CardTitle>
              </CardHeader>
              {paramsOpen && (
                <CardContent className="pt-0 space-y-3">
                  {insights.parameter_suggestions.map((p, i) => (
                    <div key={i} className="rounded-md border border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-blue-800">
                          {p.param.replace(/_/g, " ")}: {p.suggested_value}
                        </span>
                        <Badge variant="outline" className="text-xs ml-auto">{(p.confidence * 100).toFixed(0)}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{p.reason}</p>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function AiInsightsPage() {
  return (
    <AppShell>
      <AiInsightsContent />
    </AppShell>
  );
}
