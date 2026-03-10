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
  AlertCircle,
} from "lucide-react";

interface ShopifyLocation {
  id: string; name: string; isActive: boolean;
}

const steps = [
  { icon: Wifi, title: "Connect Shopify", desc: "Validate your Shopify API connection" },
  { icon: MapPin, title: "Map Locations", desc: "Assign warehouse, stores, and online channel" },
  { icon: SlidersHorizontal, title: "Business Rules", desc: "Set replenishment thresholds" },
  { icon: Database, title: "Initialize Data", desc: "Import historical data from Shopify" },
];

const ruleLabels: Record<string, { label: string; desc: string }> = {
  leadTimeDays: { label: "Lead Time (days)", desc: "Warehouse to store delivery" },
  safetyDays: { label: "Safety Stock (days)", desc: "Buffer to prevent stockouts" },
  reviewCycleDays: { label: "Review Cycle (days)", desc: "Between replenishment reviews" },
  overstockThresholdDays: { label: "Overstock Threshold (days)", desc: "Flag as overstock" },
  deadStockDays: { label: "Dead Stock (days)", desc: "No sale = dead stock" },
  warehouseBufferQty: { label: "Warehouse Buffer (qty)", desc: "Min qty in warehouse" },
  targetCoverDays: { label: "Target Cover (days)", desc: "Target at destinations" },
};

export default function WizardPage() {
  const router = useRouter();
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
    if (!shopDomain.trim()) { setError("Shop domain is required"); setLoading(false); return; }
    if (!accessToken.trim()) { setError("Access token is required"); setLoading(false); return; }
    try {
      const res = await fetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 1, data: { shopDomain: shopDomain.trim(), accessToken: accessToken.trim() } }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setShopName(data.shopName); setStep(2); }
    } catch { setError("Connection failed"); }
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
    } catch { setError("Failed to save locations"); }
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
    } catch { setError("Failed to save rules"); }
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

      // Check if response is SSE stream
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
                setBackfillStatus({
                  sync: msg.sync,
                  analytics: msg.analytics,
                });
              } else if (msg.type === "error") {
                setError(msg.error);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      } else {
        // Fallback for non-streaming response
        const data = await res.json();
        if (data.error) setError(data.error);
        else setBackfillStatus(data);
      }
    } catch { setError("Backfill failed. Please try again."); }
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
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground font-bold">
              A
            </div>
            <span className="text-lg font-bold">Adagio Setup</span>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {steps.map((s, i) => {
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
                    {s.title}
                  </span>
                  {i < steps.length - 1 && (
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
                {(() => { const Icon = steps[step - 1].icon; return <Icon className="h-5 w-5 text-primary" />; })()}
                {steps[step - 1].title}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{steps[step - 1].desc}</p>
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
                  Enter your Shopify store domain and Admin API access token to connect.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="shop-domain">Shop Domain *</Label>
                  <Input
                    id="shop-domain"
                    placeholder="my-store.myshopify.com"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Shopify store URL, e.g. <code className="bg-muted px-1 py-0.5 rounded">my-store.myshopify.com</code>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="access-token">Admin API Access Token *</Label>
                  <Input
                    id="access-token"
                    type="password"
                    placeholder="shpat_xxxxxxxxxxxxxxxx"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="h-9 font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    From Shopify Admin → Settings → Apps → Develop apps. Requires scopes: <code className="bg-muted px-1 py-0.5 rounded">read_products</code>, <code className="bg-muted px-1 py-0.5 rounded">read_inventory</code>, <code className="bg-muted px-1 py-0.5 rounded">read_orders</code>, <code className="bg-muted px-1 py-0.5 rounded">read_locations</code>, <code className="bg-muted px-1 py-0.5 rounded">write_products</code>.
                  </p>
                </div>
                {shopName && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg">
                    <Check className="h-4 w-4" />
                    Connected to: <strong>{shopName}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Locations */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Warehouse */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Warehouse Location *</Label>
                  <p className="text-xs text-muted-foreground">Central fulfillment location (not a sales channel)</p>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select warehouse..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.filter((l) => l.isActive).map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Stores */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-semibold">Store Locations</Label>
                      <p className="text-xs text-muted-foreground">Select all POS store locations</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => setStoreIds(availableStores.map((l) => l.id))}
                      >
                        Select all
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => setStoreIds([])}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  {locations.length > 5 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search locations..."
                        value={locationSearch}
                        onChange={(e) => setLocationSearch(e.target.value)}
                        className="pl-9 h-8 text-sm"
                      />
                    </div>
                  )}
                  <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border p-2">
                    {availableStores.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        {warehouseId ? "No other locations available" : "Select a warehouse first"}
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
                    <Badge variant="secondary">{storeIds.length} store(s) selected</Badge>
                  )}
                </div>

                <Separator />

                {/* Online Strategy */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Online Channel Mapping</Label>
                  <RadioGroup
                    value={onlineStrategy}
                    onValueChange={(v) => setOnlineStrategy(v as "real" | "virtual")}
                    className="grid grid-cols-2 gap-3"
                  >
                    <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${onlineStrategy === "real" ? "border-primary bg-primary/5" : ""}`}>
                      <RadioGroupItem value="real" className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Real Location</p>
                        <p className="text-xs text-muted-foreground">Map to a Shopify location</p>
                      </div>
                    </label>
                    <label className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${onlineStrategy === "virtual" ? "border-primary bg-primary/5" : ""}`}>
                      <RadioGroupItem value="virtual" className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Virtual Mapping</p>
                        <p className="text-xs text-muted-foreground">Uses fulfillment location</p>
                      </div>
                    </label>
                  </RadioGroup>
                  <Select value={onlineLocationId} onValueChange={setOnlineLocationId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select location for Online..." />
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
                      {ruleLabels[key]?.label || key}
                    </Label>
                    <Input
                      id={`wiz-${key}`}
                      type="number"
                      value={val}
                      onChange={(e) => setRules({ ...rules, [key]: parseInt(e.target.value) || 0 })}
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">{ruleLabels[key]?.desc}</p>
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
                      Import your Shopify historical data and run the first analytics computation.
                    </p>
                    {!loading && (
                      <div className="space-y-1.5 mb-4">
                        <Label htmlFor="backfill-months" className="text-sm">Months of history to import</Label>
                        <Select value={String(backfillMonths)} onValueChange={(v) => setBackfillMonths(parseInt(v))}>
                          <SelectTrigger className="h-9 w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 months</SelectItem>
                            <SelectItem value="6">6 months</SelectItem>
                            <SelectItem value="12">12 months</SelectItem>
                            <SelectItem value="18">18 months</SelectItem>
                            <SelectItem value="24">24 months</SelectItem>
                            <SelectItem value="36">36 months</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">More data improves accuracy but takes longer to import.</p>
                      </div>
                    )}
                    {loading && (
                      <div className="space-y-4">
                        {/* Phase progress steps */}
                        <div className="space-y-2 text-left">
                          {[
                            { key: "variants", label: "Syncing products & variants" },
                            { key: "inventory", label: "Syncing inventory levels" },
                            { key: "orders", label: "Syncing orders" },
                            { key: "aggregation", label: "Aggregating daily sales" },
                            { key: "analytics", label: "Running analytics engine" },
                            { key: "alerts", label: "Generating alerts" },
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
                                {p.label}
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
                      <span className="font-medium">Setup Complete!</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { label: "Products", value: backfillStatus.sync.products },
                        { label: "Variants", value: backfillStatus.sync.variants },
                        { label: "Orders", value: backfillStatus.sync.orders },
                        { label: "Inventory Records", value: backfillStatus.sync.inventoryLevels },
                        { label: "Transfer Recs", value: backfillStatus.analytics.transferCount },
                        { label: "Discount Recs", value: backfillStatus.analytics.discountCount },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border p-3 text-center">
                          <p className="text-lg font-bold">{item.value}</p>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
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
                    <ChevronLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                )}
              </div>
              <div>
                {step === 1 && (
                  <Button onClick={handleStep1} disabled={loading || !shopDomain.trim() || !accessToken.trim()}>
                    {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wifi className="h-4 w-4 mr-1" />}
                    Test Connection
                  </Button>
                )}
                {step === 2 && (
                  <Button onClick={handleStep2} disabled={loading || !warehouseId}>
                    {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    Continue <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {step === 3 && (
                  <Button onClick={handleStep3} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    Continue <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {step === 4 && !backfillStatus && (
                  <Button onClick={handleStep4} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Database className="h-4 w-4 mr-1" />}
                    Start Backfill
                  </Button>
                )}
                {step === 4 && backfillStatus && (
                  <Button onClick={() => router.push("/dashboard")}>
                    Go to Dashboard <ChevronRight className="h-4 w-4 ml-1" />
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
