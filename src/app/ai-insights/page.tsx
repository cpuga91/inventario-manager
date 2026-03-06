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

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-insights");
      const data = await res.json();
      setRun(data.run);
      setInsights(data.insights);
    } catch {
      toast.error("Failed to load AI data");
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
        toast.success("AI analysis complete");
      }
    } catch {
      toast.error("Failed to run AI analysis");
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
    toast.success("Marked as reviewed");
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
      <PageHeader title="AI Insights" subtitle="AI-powered inventory analysis and recommendations">
        <div className="flex items-center gap-2">
          {run && !run.reviewed && run.status === "SUCCESS" && (
            <Button size="sm" variant="outline" onClick={markReviewed}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Reviewed
            </Button>
          )}
          <Button size="sm" onClick={triggerRun} disabled={running}>
            {running ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Running...</>
            ) : (
              <><Play className="h-3.5 w-3.5 mr-1" /> Run Analysis</>
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
                  Last run: {new Date(run.createdAt).toLocaleString()}
                </span>
                {run.reviewed && <Badge variant="outline" className="text-xs">Reviewed</Badge>}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Model: {run.model}</span>
                <span>Tokens: {run.tokensIn ?? 0} in / {run.tokensOut ?? 0} out</span>
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
              title="No AI analysis runs yet"
              description="Click 'Run Analysis' to generate insights, or configure OPENAI_API_KEY in settings."
              action={{ label: "Run Analysis", onClick: triggerRun }}
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
                Today&apos;s Headline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-lg font-medium">{insights.summary.headline}</p>
              {insights.summary.top_risk_locations.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top Risk Locations</p>
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
                  AI Prioritized Transfers
                  <Badge variant="secondary" className="ml-2">{insights.prioritized_transfers.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm sticky-header">
                      <thead>
                        <tr className="border-b bg-muted/50 text-muted-foreground">
                          <th className="p-3 text-center font-medium">Priority</th>
                          <th className="p-3 text-left font-medium">SKU</th>
                          <th className="p-3 text-left font-medium">To</th>
                          <th className="p-3 text-right font-medium">Qty</th>
                          <th className="p-3 text-center font-medium">Confidence</th>
                          <th className="p-3 text-center font-medium">Cover</th>
                          <th className="p-3 text-left font-medium">Rationale</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.prioritized_transfers.map((t, i) => (
                          <tr key={i} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-3 text-center">
                              <StatusChip variant={t.priority >= 70 ? "critical" : t.priority >= 40 ? "warning" : "success"}>
                                {t.priority}
                              </StatusChip>
                            </td>
                            <td className="p-3 font-medium">{t.sku}</td>
                            <td className="p-3">{t.to_location}</td>
                            <td className="p-3 text-right font-bold text-primary tabular-nums">{t.qty}</td>
                            <td className="p-3 text-center">
                              <Badge variant="outline">{(t.confidence * 100).toFixed(0)}%</Badge>
                            </td>
                            <td className="p-3 text-center">{t.evidence.days_of_cover.toFixed(0)}d</td>
                            <td className="p-3 text-muted-foreground truncate max-w-[200px]">{t.rationale}</td>
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
                  AI Discount Suggestions
                  <Badge variant="secondary" className="ml-2">{insights.discount_actions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm sticky-header">
                      <thead>
                        <tr className="border-b bg-muted/50 text-muted-foreground">
                          <th className="p-3 text-left font-medium">SKU</th>
                          <th className="p-3 text-left font-medium">Location</th>
                          <th className="p-3 text-center font-medium">Discount</th>
                          <th className="p-3 text-center font-medium">Confidence</th>
                          <th className="p-3 text-right font-medium">On Hand</th>
                          <th className="p-3 text-center font-medium">Cover</th>
                          <th className="p-3 text-left font-medium">Rationale</th>
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
                  Anomalies Detected
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
                        <span className="text-xs text-muted-foreground">at {a.location}</span>
                        <Badge variant="outline" className="text-xs ml-auto">{(a.confidence * 100).toFixed(0)}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{a.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {a.evidence.metric}: {a.evidence.value} (baseline: {a.evidence.baseline})
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
                  Parameter Suggestions
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
