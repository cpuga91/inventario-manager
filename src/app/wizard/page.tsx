"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Package, Wifi, MapPin, SlidersHorizontal, Database,
  Check, ChevronLeft, ChevronRight, Loader2, Search,
  AlertCircle, Globe,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ShopifyLocation {
  id: string; name: string; isActive: boolean;
}

const stepIcons = [Wifi, MapPin, SlidersHorizontal, Database];
const stepTitleKeys = ["wizard.step1Title", "wizard.step2Title", "wizard.step3Title", "wizard.step4Title"];
const stepDescKeys = ["wizard.step1Desc", "wizard.step2Desc", "wizard.step3Desc", "wizard.step4Desc"];

const ruleKeys: Record<string, { labelKey: string; descKey: string }> = {
  leadTimeDays: { labelKey: "wizard.leadTime", descKey: "wizard.leadTimeDesc" },
  safetyDays: { labelKey: "wizard.safetyStock", descKey: "wizard.safetyStockDesc" },
  reviewCycleDays: { labelKey: "wizard.reviewCycle", descKey: "wizard.reviewCycleDesc" },
  overstockThresholdDays: { labelKey: "wizard.overstockThreshold", descKey: "wizard.overstockThresholdDesc" },
  deadStockDays: { labelKey: "wizard.deadStockDays", descKey: "wizard.deadStockDaysDesc" },
  warehouseBufferQty: { labelKey: "wizard.warehouseBuffer", descKey: "wizard.warehouseBufferDesc" },
  targetCoverDays: { labelKey: "wizard.targetCover", descKey: "wizard.targetCoverDesc" },
};

export default function WizardPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [shopName, setShopName] = useState("");

  // Step 2
  const [locations, setLocations] = useState<ShopifyLocation[]>([]);
  const [locationSearch, setLocationSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [onlineStrategy, setOnlineStrategy] = useState<"real" | "virtual">("real");
  const [onlineLocationId, setOnlineLocationId] = useState("");

  // Step 3
  const [rules, setRules] = useState({
    leadTimeDays: 3, safetyDays: 2, reviewCycleDays: 7,
    overstockThresholdDays: 90, deadStockDays: 180,
    warehouseBufferQty: 5, targetCoverDays: 30,
  });

  // Step 4
  const [backfillMonths, setBackfillMonths] = useState(12);
  const [backfillStatus, setBackfillStatus] = useState<null | {
    sync: { products: number; variants: number; orders: number; inventoryLevels: number };
    analytics: { transferCount: number; discountCount: number };
  }>(null);
  const [backfillPhase, setBackfillPhase] = useState("");
  const [backfillDetail, setBackfillDetail] = useState("");

  // Resume wizard
  useEffect(() => {
    fetch("/api/wizard")
      .then((r) => r.json())
      .then((data) => {
        if (data.wizardComplete) router.push("/dashboard");
        else if (data.wizardStep > 0) setStep(data.wizardStep + 1);
        if (data.shopDomain) setShopDomain(data.shopDomain);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const fetchLocations = useCallback(async () => {
    const res = await fetch("/api/wizard/locations");
    const data = await res.json();
    if (data.locations) setLocations(data.locations);
  }, []);

  useEffect(() => {
    if (step === 2 && locations.length === 0) fetchLocations();
  }, [step, locations.length, fetchLocations]);

  const handleStep1 = async () => {
    setLoading(true); setError("");
    if (!shopDomain.trim()) { setError(t("wizard.shopDomainRequired")); setLoading(false); return; }
    if (!accessToken.trim()) { setError(t("wizard.accessTokenRequired")); setLoading(false); return; }
    try {
      const res = await fetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 1, data: { shopDomain: shopDomain.trim(), accessToken: accessToken.trim() } }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShopName(data.shopName); setStep(2); }
    } catch { setError(t("wizard.connectionFailed")); }
    finally { setLoading(false); }
  };

  const handleStep2 = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 2, data: { warehouseId, storeIds, onlineStrategy, onlineLocationId } }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setStep(3);
    } catch { setError(t("wizard.failedLocations")); }
    finally { setLoading(false); }
  };

  const handleStep3 = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 3, data: rules }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setStep(4);
    } catch { setError(t("wizard.failedRules")); }
    finally { setLoading(false); }
  };

  const handleStep4 = async () => {
    setLoading(true); setError(""); setBackfillPhase(""); setBackfillDetail("");
    try {
      const res = await fetch("/api/sync/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months: backfillMonths }),
      });

      if (res.headers.get("Content-Type")?.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const chunk of lines) {
            const dataLine = chunk.trim().replace(/^data: /, "");
            if (!dataLine) continue;
            try {
              const msg = JSON.parse(dataLine);
              if (msg.type === "phase") {
                setBackfillPhase(msg.phase);
                setBackfillDetail(msg.message);
              } else if (msg.type === "progress") {
                setBackfillDetail(msg.detail);
              } else if (msg.type === "complete") {
                setBackfillStatus({ sync: msg.sync, analytics: msg.analytics });
              } else if (msg.type === "error") {
                setError(msg.error);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      } else {
        const data = await res.json();
        if (data.error) setError(data.error);
        else setBackfillStatus(data);
      }
    } catch { setError(t("wizard.backfillFailed")); }
    finally { setLoading(false); }
  };

  const filteredLocations = locations.filter((l) =>
    l.isActive && l.name.toLowerCase().includes(locationSearch.toLowerCase())
  );

  const availableStores = filteredLocations.filter((l) => l.id !== warehouseId);

  const progressPercent = ((step - 1) / 4) * 100 + (backfillStatus ? 25 : 0);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Logo + Language */}
        <div className="flex items-center justify-center mb-8 relative">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground font-bold">
              A
            </div>
            <span className="text-lg font-bold">{t("wizard.title")}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 h-8 text-xs gap-1.5"
            onClick={() => setLocale(locale === "en" ? "es" : "en")}
          >
            <Globe className="h-3.5 w-3.5" />
            {locale === "en" ? "ES" : "EN"}
          </Button>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {stepTitleKeys.map((tKey, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === step;
              const isDone = stepNum < step || (stepNum === 4 && backfillStatus);
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    isDone ? "bg-primary text-primary-foreground" :
                    isActive ? "bg-primary text-primary-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isDone ? <Check className="h-4 w-4" /> : stepNum}
                  </div>
                  <span className={`hidden sm:inline text-sm ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                    {t(tKey)}
                  </span>
                  {i < stepTitleKeys.length - 1 && (
                    <div className={`hidden sm:block w-8 lg:w-16 h-px ${stepNum < step ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
          <Progress value={progressPercent} className="h-1" />
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="p-6">
            {/* Step Header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {(() => { const Icon = stepIcons[step - 1]; return <Icon className="h-5 w-5 text-primary" />; })()}
                {t(stepTitleKeys[step - 1])}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{t(stepDescKeys[step - 1])}</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-destructive/10 text-destructive p-3 rounded-lg text-sm mb-4">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Connect Shopify */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("wizard.enterCredentials")}
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="shop-domain">{t("wizard.shopDomain")} *</Label>
                  <Input
                    id="shop-domain"
                    placeholder="my-store.myshopify.com"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("wizard.shopDomainHint")} <code className="bg-muted px-1 py-0.5 rounded">my-store.myshopify.com</code>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="access-token">{t("wizard.accessToken")} *</Label>
                  <Input
                    id="access-token"
                    type="password"
                    placeholder="shpat_xxxxxxxxxxxxxxxx"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="h-9 font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("wizard.accessTokenHint")} <code className="bg-muted px-1 py-0.5 rounded">read_products</code>, <code className="bg-muted px-1 py-0.5 rounded">read_inventory</code>, <code className="bg-muted px-1 py-0.5 rounded">read_orders</code>, <code className="bg-muted px-1 py-0.5 rounded">read_locations</code>, <code className="bg-muted px-1 py-0.5 rounded">write_products</code>.
                  </p>
                </div>
                {shopName && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg">
                    <Check className="h-4 w-4" />
                    {t("wizard.connectedTo")} <strong>{shopName}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Locations */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t("wizard.warehouseLocation")} *</Label>
                  <p className="text-xs text-muted-foreground">{t("wizard.warehouseHint")}</p>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("wizard.selectWarehouse")} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.filter((l) => l.isActive).map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-semibold">{t("wizard.storeLocations")}</Label>
                      <p className="text-xs text-muted-foreground">{t("wizard.selectAllPos")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setStoreIds(availableStores.map((l) => l.id))}>
                        {t("wizard.selectAll")}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setStoreIds([])}>
                        {t("wizard.clear")}
                      </Button>
                    </div>
                  </div>
                  {locations.length > 5 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder={t("wizard.searchLocations")}
                        value={locationSearch}
                        onChange={(e) => setLocationSearch(e.target.value)}
                        className="pl-9 h-8 text-sm"
                      />
                    </div>
                  )}
                  <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border p-2">
                    {availableStores.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        {warehouseId ? t("wizard.noOtherLocations") : t("wizard.selectWarehouseFirst")}
                      </p>
                    ) : (
                      availableStores.map((l) => (
                        <label key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                          <Checkbox
                            checked={storeIds.includes(l.id)}
                            onCheckedChange={() => {
                              setStoreIds((prev) =>
                                prev.includes(l.id) ? prev.filter((s) => s !== l.id) : [...prev, l.id]
                              );
                            }}
                          />
                          <span className="text-sm">{l.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {storeIds.length > 0 && (
                    <Badge variant="secondary">{storeIds.length} {t("wizard.storesSelected")}</Badge>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">{t("wizard.onlineMapping")}</Label>
                  <RadioGroup
                    value={onlineStrategy}
                    onValueChange={(v) => setOnlineStrategy(v as "real" | "virtual")}
                    className="grid grid-cols-2 gap-3"
                  >
                    <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${onlineStrategy === "real" ? "border-primary bg-primary/5" : ""}`}>
                      <RadioGroupItem value="real" className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{t("wizard.realLocation")}</p>
                        <p className="text-xs text-muted-foreground">{t("wizard.mapToShopify")}</p>
                      </div>
                    </label>
                    <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${onlineStrategy === "virtual" ? "border-primary bg-primary/5" : ""}`}>
                      <RadioGroupItem value="virtual" className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{t("wizard.virtualMapping")}</p>
                        <p className="text-xs text-muted-foreground">{t("wizard.usesFulfillment")}</p>
                      </div>
                    </label>
                  </RadioGroup>
                  <Select value={onlineLocationId} onValueChange={setOnlineLocationId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("wizard.selectOnline")} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.filter((l) => l.isActive).map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 3: Business Rules */}
            {step === 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(rules).map(([key, val]) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`wiz-${key}`} className="text-sm">
                      {t(ruleKeys[key]?.labelKey || key)}
                    </Label>
                    <Input
                      id={`wiz-${key}`}
                      type="number"
                      value={val}
                      onChange={(e) => setRules({ ...rules, [key]: parseInt(e.target.value) || 0 })}
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">{t(ruleKeys[key]?.descKey || key)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Step 4: Backfill */}
            {step === 4 && (
              <div className="space-y-4">
                {!backfillStatus ? (
                  <div className="py-4">
                    <p className="text-sm text-muted-foreground mb-4 text-center">
                      {t("wizard.importDesc")}
                    </p>
                    {!loading && (
                      <div className="space-y-1.5 mb-4">
                        <Label htmlFor="backfill-months" className="text-sm">{t("wizard.monthsLabel")}</Label>
                        <Select value={String(backfillMonths)} onValueChange={(v) => setBackfillMonths(parseInt(v))}>
                          <SelectTrigger className="h-9 w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[3, 6, 12, 18, 24, 36].map((m) => (
                              <SelectItem key={m} value={String(m)}>{m} {t("wizard.months")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">{t("wizard.monthsHint")}</p>
                      </div>
                    )}
                    {loading && (
                      <div className="space-y-4">
                        <div className="space-y-2 text-left">
                          {[
                            { key: "variants", tKey: "wizard.syncVariants" },
                            { key: "inventory", tKey: "wizard.syncInventory" },
                            { key: "orders", tKey: "wizard.syncOrders" },
                            { key: "aggregation", tKey: "wizard.aggregating" },
                            { key: "analytics", tKey: "wizard.runningAnalytics" },
                            { key: "alerts", tKey: "wizard.generatingAlerts" },
                          ].map((p) => {
                            const phases = ["variants", "inventory", "orders", "aggregation", "analytics", "alerts"];
                            const currentIdx = phases.indexOf(backfillPhase);
                            const thisIdx = phases.indexOf(p.key);
                            const isDone = thisIdx < currentIdx;
                            const isActive = p.key === backfillPhase;
                            return (
                              <div key={p.key} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 ${
                                isActive ? "bg-primary/10 text-primary font-medium" :
                                isDone ? "text-emerald-600" : "text-muted-foreground"
                              }`}>
                                {isDone ? (
                                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                                ) : isActive ? (
                                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                ) : (
                                  <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
                                )}
                                {t(p.tKey)}
                              </div>
                            );
                          })}
                        </div>
                        {backfillDetail && (
                          <p className="text-xs text-muted-foreground text-center">{backfillDetail}</p>
                        )}
                        <Progress value={undefined} className="h-1" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">{t("wizard.setupComplete")}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { tKey: "wizard.products", value: backfillStatus.sync.products },
                        { tKey: "wizard.variants", value: backfillStatus.sync.variants },
                        { tKey: "wizard.orders", value: backfillStatus.sync.orders },
                        { tKey: "wizard.inventoryRecords", value: backfillStatus.sync.inventoryLevels },
                        { tKey: "wizard.transferRecs", value: backfillStatus.analytics.transferCount },
                        { tKey: "wizard.discountRecs", value: backfillStatus.analytics.discountCount },
                      ].map((item) => (
                        <div key={item.tKey} className="rounded-lg border p-3 text-center">
                          <p className="text-lg font-bold">{item.value}</p>
                          <p className="text-xs text-muted-foreground">{t(item.tKey)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t">
              <div>
                {step > 1 && !backfillStatus && (
                  <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} disabled={loading}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> {t("wizard.back")}
                  </Button>
                )}
              </div>
              <div>
                {step === 1 && (
                  <Button onClick={handleStep1} disabled={loading || !shopDomain.trim() || !accessToken.trim()}>
                    {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wifi className="h-4 w-4 mr-1" />}
                    {t("wizard.testConnection")}
                  </Button>
                )}
                {step === 2 && (
                  <Button onClick={handleStep2} disabled={loading || !warehouseId}>
                    {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    {t("wizard.continue")} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {step === 3 && (
                  <Button onClick={handleStep3} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    {t("wizard.continue")} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {step === 4 && !backfillStatus && (
                  <Button onClick={handleStep4} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Database className="h-4 w-4 mr-1" />}
                    {t("wizard.startBackfill")}
                  </Button>
                )}
                {step === 4 && backfillStatus && (
                  <Button onClick={() => router.push("/dashboard")}>
                    {t("wizard.goToDashboard")} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
