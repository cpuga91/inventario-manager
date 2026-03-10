"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppShell, { useAppShell } from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings, Save, Download, Upload, Play, Brain,
  RotateCcw, Trash2, Loader2, CheckCircle2, AlertTriangle,
  Zap, Shield, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

interface OpenAiSettingsState {
  isEnabled: boolean; model: string; dailyHourLocal: number; timezone: string;
  maxSkus: number; promptVersion: string;
  keyStorageMode: "ENV_ONLY" | "DB_ENCRYPTED";
  hasStoredKey: boolean; apiKeyLast4: string | null;
}

interface WizardState {
  wizardStep: number; wizardComplete: boolean; lastUpdated: string | null;
}

type ResetMode = "SOFT" | "HARD" | null;

const fieldKeys: Record<string, { labelKey: string; descKey: string }> = {
  leadTimeDays: { labelKey: "settings.leadTime", descKey: "settings.leadTimeDesc" },
  safetyDays: { labelKey: "settings.safetyStock", descKey: "settings.safetyStockDesc" },
  reviewCycleDays: { labelKey: "settings.reviewCycle", descKey: "settings.reviewCycleDesc" },
  overstockThresholdDays: { labelKey: "settings.overstockThreshold", descKey: "settings.overstockThresholdDesc" },
  deadStockDays: { labelKey: "settings.deadStockLabel", descKey: "settings.deadStockDesc" },
  warehouseBufferQty: { labelKey: "settings.warehouseBuffer", descKey: "settings.warehouseBufferDesc" },
  targetCoverDays: { labelKey: "settings.targetCover", descKey: "settings.targetCoverDesc" },
};

function SettingsContent() {
  const router = useRouter();
  const { user } = useAppShell();
  const { t } = useI18n();
  const [rules, setRules] = useState({
    leadTimeDays: 3, safetyDays: 2, reviewCycleDays: 7,
    overstockThresholdDays: 90, deadStockDays: 180,
    warehouseBufferQty: 5, targetCoverDays: 30,
  });
  const [originalRules, setOriginalRules] = useState(rules);
  const [saving, setSaving] = useState(false);

  // OpenAI
  const [aiSettings, setAiSettings] = useState<OpenAiSettingsState>({
    isEnabled: false, model: "gpt-4o-mini", dailyHourLocal: 7,
    timezone: "America/Santiago", maxSkus: 150, promptVersion: "v1.0",
    keyStorageMode: "ENV_ONLY", hasStoredKey: false, apiKeyLast4: null,
  });
  const [encryptionAvailable, setEncryptionAvailable] = useState(false);
  const [envKeyConfigured, setEnvKeyConfigured] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [runningAi, setRunningAi] = useState(false);

  // Wizard
  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [resetMode, setResetMode] = useState<ResetMode>(null);
  const [confirmText, setConfirmText] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/admin/openai-settings").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/admin/wizard-reset").then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([data, aiData, wizData]) => {
      if (data.globalRule) {
        const r = {
          leadTimeDays: data.globalRule.leadTimeDays ?? 3,
          safetyDays: data.globalRule.safetyDays ?? 2,
          reviewCycleDays: data.globalRule.reviewCycleDays ?? 7,
          overstockThresholdDays: data.globalRule.overstockThresholdDays ?? 90,
          deadStockDays: data.globalRule.deadStockDays ?? 180,
          warehouseBufferQty: data.globalRule.warehouseBufferQty ?? 5,
          targetCoverDays: data.globalRule.targetCoverDays ?? 30,
        };
        setRules(r);
        setOriginalRules(r);
      }
      if (aiData?.settings) {
        setAiSettings(aiData.settings);
        setEncryptionAvailable(aiData.encryptionAvailable ?? false);
        setEnvKeyConfigured(aiData.envKeyConfigured ?? false);
      }
      if (wizData) setWizardState(wizData);
    });
  }, []);

  const rulesChanged = JSON.stringify(rules) !== JSON.stringify(originalRules);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      const data = await res.json();
      if (data.success) {
        setOriginalRules(rules);
        toast.success(t("settings.thresholdsSaved"));
      } else {
        toast.error(data.error || t("settings.failedToSave"));
      }
    } catch {
      toast.error(t("settings.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleRunAnalytics = async () => {
    toast.info(t("settings.runningAnalytics"));
    try {
      const res = await fetch("/api/analytics/run", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`${t("settings.analyticsComplete")}: ${data.transferCount} transfers, ${data.discountCount} discounts`);
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error(t("settings.analyticsRunFailed"));
    }
  };

  const handleAiSave = async () => {
    setAiSaving(true);
    try {
      const payload: Record<string, unknown> = {
        isEnabled: aiSettings.isEnabled, model: aiSettings.model,
        dailyHourLocal: aiSettings.dailyHourLocal, timezone: aiSettings.timezone,
        maxSkus: aiSettings.maxSkus, keyStorageMode: aiSettings.keyStorageMode,
      };
      if (apiKeyInput.trim()) payload.apiKey = apiKeyInput.trim();
      const res = await fetch("/api/admin/openai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setAiSettings(data.settings);
        setApiKeyInput("");
        toast.success(t("settings.openaiSettingsSaved"));
      } else {
        toast.error(data.error || data.details?.join(", "));
      }
    } catch {
      toast.error(t("settings.failedToSave"));
    } finally {
      setAiSaving(false);
    }
  };

  const handleRemoveKey = async () => {
    setAiSaving(true);
    try {
      const res = await fetch("/api/admin/openai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeKey: true }),
      });
      const data = await res.json();
      if (data.success) {
        setAiSettings(data.settings);
        toast.success(t("settings.storedApiKeyRemoved"));
      }
    } catch {
      toast.error(t("settings.failedToRemoveKey"));
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/openai-test", { method: "POST" });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    } catch {
      toast.error(t("settings.connectionTestFailed"));
    } finally {
      setTesting(false);
    }
  };

  const handleRunAiNow = async () => {
    setRunningAi(true);
    toast.info(t("settings.runningAiAnalysis"));
    try {
      const res = await fetch("/api/admin/openai-run", { method: "POST" });
      const data = await res.json();
      if (data.success) toast.success(`${t("settings.aiAnalysis")}: ${data.run.status}`);
      else toast.error(data.error);
    } catch {
      toast.error(t("settings.aiRunFailed"));
    } finally {
      setRunningAi(false);
    }
  };

  const handleReset = async () => {
    if (!resetMode) return;
    const expected = resetMode === "SOFT" ? "RESET WIZARD" : "DELETE TENANT DATA";
    if (confirmText !== expected) return;
    setResetSubmitting(true);
    try {
      const res = await fetch("/api/admin/wizard-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: resetMode, confirmText }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(resetMode === "SOFT" ? t("settings.wizardReset") : t("settings.dataDeletedRedirecting"));
        setResetMode(null);
        setConfirmText("");
        setTimeout(() => router.push("/wizard"), 1500);
      } else {
        toast.error(data.error || t("settings.resetFailed"));
      }
    } catch {
      toast.error(t("settings.requestFailed"));
    } finally {
      setResetSubmitting(false);
    }
  };

  const isAdmin = user.role === "ADMIN";

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      {/* Global Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t("settings.thresholds")}
          </CardTitle>
          <CardDescription>
            {t("settings.thresholdsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(rules).map(([key, val]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key} className="text-sm">
                  {t(fieldKeys[key]?.labelKey || key)}
                </Label>
                <Input
                  id={key}
                  type="number"
                  value={val}
                  onChange={(e) => setRules({ ...rules, [key]: parseInt(e.target.value) || 0 })}
                  disabled={!isAdmin}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">{t(fieldKeys[key]?.descKey || key)}</p>
              </div>
            ))}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving || !rulesChanged} size="sm">
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                {t("settings.saveThresholds")}
              </Button>
              {!rulesChanged && <span className="text-xs text-muted-foreground">{t("settings.noChanges")}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            {t("settings.actions")}
          </CardTitle>
          <CardDescription>{t("settings.actionsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleRunAnalytics}>
              <Play className="h-3.5 w-3.5 mr-1" /> {t("settings.runAnalytics")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open("/api/settings/export", "_blank")}>
              <Download className="h-3.5 w-3.5 mr-1" /> {t("settings.exportConfig")}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="h-3.5 w-3.5 mr-1" /> {t("settings.importConfig")}
                <input
                  type="file"
                  accept=".json"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const config = JSON.parse(text);
                      const res = await fetch("/api/settings/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(config),
                      });
                      const data = await res.json();
                      toast.success(data.message || t("settings.imported"));
                    } catch {
                      toast.error(t("settings.invalidJsonFile"));
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OpenAI Settings */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4" />
              {t("settings.openaiConfig")}
            </CardTitle>
            <CardDescription>{t("settings.openaiConfigDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable toggle */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="aiEnabled"
                checked={aiSettings.isEnabled}
                onCheckedChange={(v) => setAiSettings({ ...aiSettings, isEnabled: v === true })}
              />
              <Label htmlFor="aiEnabled" className="cursor-pointer">{t("settings.enableOpenai")}</Label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("ai.model")}</Label>
                <Select value={aiSettings.model} onValueChange={(v) => setAiSettings({ ...aiSettings, model: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                    <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                    <SelectItem value="gpt-4-turbo">gpt-4-turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.dailyRunHour")}</Label>
                <Input
                  type="number" min={0} max={23}
                  value={aiSettings.dailyHourLocal}
                  onChange={(e) => setAiSettings({ ...aiSettings, dailyHourLocal: parseInt(e.target.value) || 0 })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.timezone")}</Label>
                <Input
                  value={aiSettings.timezone}
                  onChange={(e) => setAiSettings({ ...aiSettings, timezone: e.target.value })}
                  placeholder="America/Santiago"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.maxSkus")}</Label>
                <Input
                  type="number" min={1} max={1000}
                  value={aiSettings.maxSkus}
                  onChange={(e) => setAiSettings({ ...aiSettings, maxSkus: parseInt(e.target.value) || 150 })}
                  className="h-9"
                />
              </div>
            </div>

            <Separator />

            {/* API Key Management */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> {t("settings.apiKeyMgmt")}
              </h3>
              <RadioGroup
                value={aiSettings.keyStorageMode}
                onValueChange={(v) => setAiSettings({ ...aiSettings, keyStorageMode: v as "ENV_ONLY" | "DB_ENCRYPTED" })}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ENV_ONLY" id="envOnly" />
                  <Label htmlFor="envOnly" className="cursor-pointer text-sm">
                    {t("settings.envVariable")}
                    {envKeyConfigured ? (
                      <Badge variant="outline" className="ml-2 text-xs text-emerald-600">{t("settings.configured")}</Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2 text-xs text-amber-600">{t("settings.notSet")}</Badge>
                    )}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="DB_ENCRYPTED" id="dbEncrypted" disabled={!encryptionAvailable} />
                  <Label htmlFor="dbEncrypted" className={`cursor-pointer text-sm ${!encryptionAvailable ? "text-muted-foreground" : ""}`}>
                    {t("settings.storeEncrypted")}
                    {!encryptionAvailable && <span className="text-xs ml-1">(set APP_ENCRYPTION_KEY)</span>}
                  </Label>
                </div>
              </RadioGroup>

              {aiSettings.keyStorageMode === "DB_ENCRYPTED" && (
                <div className="space-y-2 pl-6">
                  {aiSettings.hasStoredKey && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-emerald-600">
                        Key stored (****{aiSettings.apiKeyLast4})
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={handleRemoveKey} disabled={aiSaving}>
                        Remove
                      </Button>
                    </div>
                  )}
                  <Input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-..."
                    className="h-9 max-w-md"
                    autoComplete="off"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={handleAiSave} disabled={aiSaving}>
                {aiSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                {t("settings.saveOpenai")}
              </Button>
              <Button size="sm" variant="outline" onClick={handleTestConnection} disabled={testing}>
                {testing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                {t("settings.testConnection")}
              </Button>
              <Button size="sm" variant="outline" onClick={handleRunAiNow} disabled={runningAi}>
                {runningAi ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                {t("settings.runAiNow")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup Wizard */}
      {isAdmin && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Setup Wizard
            </CardTitle>
            <CardDescription>Reset your onboarding wizard to reconfigure locations and thresholds.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {wizardState && (
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
                  <p className={`font-medium ${wizardState.wizardComplete ? "text-emerald-600" : "text-amber-600"}`}>
                    {wizardState.wizardComplete ? "Configured" : "Not configured"}
                  </p>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Step</span>
                  <p className="font-medium">{wizardState.wizardStep} / 4</p>
                </div>
                {wizardState.lastUpdated && (
                  <>
                    <Separator orientation="vertical" className="h-8" />
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Updated</span>
                      <p className="font-medium">{new Date(wizardState.lastUpdated).toLocaleDateString()}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setResetMode("SOFT")}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Soft Reset
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setResetMode("HARD")}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Hard Reset
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Soft reset re-runs the wizard keeping data. Hard reset deletes all tenant data.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reset Dialog */}
      <Dialog open={!!resetMode} onOpenChange={(open) => { if (!open) { setResetMode(null); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={resetMode === "HARD" ? "text-destructive" : "text-amber-600"}>
              {resetMode === "SOFT" ? "Restart Setup Wizard" : "Hard Reset — Delete Tenant Data"}
            </DialogTitle>
            <DialogDescription>
              {resetMode === "SOFT" ? (
                "This resets the wizard to step 1. All historical data will be preserved."
              ) : (
                "This will permanently delete all tenant operational data. This cannot be undone."
              )}
            </DialogDescription>
          </DialogHeader>
          {resetMode === "HARD" && (
            <ul className="text-sm text-destructive list-disc ml-5 space-y-0.5">
              <li>Orders & order lines</li>
              <li>Inventory levels & daily sales</li>
              <li>Products & variants</li>
              <li>Recommendations & AI runs</li>
              <li>Location mappings & rules</li>
            </ul>
          )}
          <div className="space-y-2">
            <Label>
              Type <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-bold">
                {resetMode === "SOFT" ? "RESET WIZARD" : "DELETE TENANT DATA"}
              </code> to confirm
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={resetMode === "SOFT" ? "RESET WIZARD" : "DELETE TENANT DATA"}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetMode(null); setConfirmText(""); }} disabled={resetSubmitting}>
              Cancel
            </Button>
            <Button
              variant={resetMode === "HARD" ? "destructive" : "default"}
              onClick={handleReset}
              disabled={resetSubmitting || confirmText !== (resetMode === "SOFT" ? "RESET WIZARD" : "DELETE TENANT DATA")}
            >
              {resetSubmitting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
              {resetMode === "SOFT" ? "Reset Wizard" : "Delete & Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsContent />
    </AppShell>
  );
}
