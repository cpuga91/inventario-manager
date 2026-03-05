"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ShopifyLocation {
  id: string;
  name: string;
  isActive: boolean;
}

export default function WizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Step 1
  const [shopName, setShopName] = useState("");

  // Step 2
  const [locations, setLocations] = useState<ShopifyLocation[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [onlineStrategy, setOnlineStrategy] = useState<"real" | "virtual">("real");
  const [onlineLocationId, setOnlineLocationId] = useState("");

  // Step 3
  const [rules, setRules] = useState({
    leadTimeDays: 3,
    safetyDays: 2,
    reviewCycleDays: 7,
    overstockThresholdDays: 90,
    deadStockDays: 180,
    warehouseBufferQty: 5,
    targetCoverDays: 30,
  });

  // Step 4
  const [backfillStatus, setBackfillStatus] = useState<null | {
    sync: { products: number; variants: number; orders: number; inventoryLevels: number };
    analytics: { transferCount: number; discountCount: number };
  }>(null);

  // Resume wizard from last step
  useEffect(() => {
    fetch("/api/wizard")
      .then((r) => r.json())
      .then((data) => {
        if (data.wizardComplete) {
          router.push("/dashboard");
        } else if (data.wizardStep > 0) {
          setStep(data.wizardStep + 1);
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const fetchLocations = useCallback(async () => {
    const res = await fetch("/api/wizard/locations");
    const data = await res.json();
    if (data.locations) setLocations(data.locations);
  }, []);

  useEffect(() => {
    if (step === 2 && locations.length === 0) {
      fetchLocations();
    }
  }, [step, locations.length, fetchLocations]);

  const handleStep1 = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 1 }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setShopName(data.shopName);
        setStep(2);
      }
    } catch (e) {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: 2,
          data: { warehouseId, storeIds, onlineStrategy, onlineLocationId },
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setStep(3);
    } catch {
      setError("Failed to save locations");
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 3, data: rules }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setStep(4);
    } catch {
      setError("Failed to save rules");
    } finally {
      setLoading(false);
    }
  };

  const handleStep4 = async () => {
    setLoading(true);
    setError("");
    setMessage("Running backfill + analytics... This may take several minutes.");
    try {
      const res = await fetch("/api/sync/backfill", { method: "POST" });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setBackfillStatus(data);
        setMessage("Setup complete!");
      }
    } catch {
      setError("Backfill failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleStoreId = (id: string) => {
    setStoreIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-emerald-700 mb-2">Setup Wizard</h1>
        <div className="flex items-center space-x-2 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step
                  ? "bg-emerald-600 text-white"
                  : s < step
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {s}
            </div>
          ))}
          <span className="text-sm text-gray-500 ml-2">
            {step === 1 && "Connect Shopify"}
            {step === 2 && "Map Locations"}
            {step === 3 && "Business Rules"}
            {step === 4 && "Initialize Data"}
          </span>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded text-sm mb-4">{error}</div>}
        {message && !error && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded text-sm mb-4">{message}</div>
        )}

        {/* Step 1: Connect Shopify */}
        {step === 1 && (
          <div>
            <p className="text-gray-600 mb-4">
              We will validate your Shopify connection using the SHOPIFY_SHOP and
              SHOPIFY_ACCESS_TOKEN environment variables.
            </p>
            <button
              onClick={handleStep1}
              disabled={loading}
              className="bg-emerald-600 text-white px-6 py-2 rounded font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Testing connection..." : "Test Connection"}
            </button>
            {shopName && (
              <p className="mt-3 text-green-700">Connected to: {shopName}</p>
            )}
          </div>
        )}

        {/* Step 2: Locations */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warehouse Location (not assigned to sales channels)
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select warehouse...</option>
                {locations.filter((l) => l.isActive).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store Locations (select all POS stores)
              </label>
              <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-2">
                {locations
                  .filter((l) => l.isActive && l.id !== warehouseId)
                  .map((l) => (
                    <label key={l.id} className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={storeIds.includes(l.id)}
                        onChange={() => toggleStoreId(l.id)}
                      />
                      <span>{l.name}</span>
                    </label>
                  ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Online Channel Mapping
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm">
                  <input
                    type="radio"
                    value="real"
                    checked={onlineStrategy === "real"}
                    onChange={() => setOnlineStrategy("real")}
                  />
                  <span>Map to a real Shopify location</span>
                </label>
                <label className="flex items-center space-x-2 text-sm">
                  <input
                    type="radio"
                    value="virtual"
                    checked={onlineStrategy === "virtual"}
                    onChange={() => setOnlineStrategy("virtual")}
                  />
                  <span>Virtual mapping (uses a fulfillment location for inventory)</span>
                </label>
              </div>
              {(onlineStrategy === "real" || onlineStrategy === "virtual") && (
                <select
                  value={onlineLocationId}
                  onChange={(e) => setOnlineLocationId(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm mt-2"
                >
                  <option value="">Select location for Online...</option>
                  {locations.filter((l) => l.isActive).map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={handleStep2}
              disabled={loading || !warehouseId}
              className="bg-emerald-600 text-white px-6 py-2 rounded font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Next: Business Rules"}
            </button>
          </div>
        )}

        {/* Step 3: Business Rules */}
        {step === 3 && (
          <div className="space-y-3">
            {Object.entries(rules).map(([key, val]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                </label>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => setRules({ ...rules, [key]: parseInt(e.target.value) || 0 })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            ))}
            <button
              onClick={handleStep3}
              disabled={loading}
              className="bg-emerald-600 text-white px-6 py-2 rounded font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Next: Initialize Data"}
            </button>
          </div>
        )}

        {/* Step 4: Backfill */}
        {step === 4 && (
          <div>
            <p className="text-gray-600 mb-4">
              This will import your last 12 months of data from Shopify and run the first analytics computation.
            </p>
            {!backfillStatus ? (
              <button
                onClick={handleStep4}
                disabled={loading}
                className="bg-emerald-600 text-white px-6 py-2 rounded font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "Running backfill..." : "Start Backfill"}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-50 p-4 rounded">
                  <h3 className="font-medium text-green-800 mb-2">Backfill Complete</h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>Products: {backfillStatus.sync.products}</li>
                    <li>Variants: {backfillStatus.sync.variants}</li>
                    <li>Orders: {backfillStatus.sync.orders}</li>
                    <li>Inventory records: {backfillStatus.sync.inventoryLevels}</li>
                    <li>Transfer recommendations: {backfillStatus.analytics.transferCount}</li>
                    <li>Discount recommendations: {backfillStatus.analytics.discountCount}</li>
                  </ul>
                </div>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="bg-emerald-600 text-white px-6 py-2 rounded font-medium hover:bg-emerald-700"
                >
                  Go to Dashboard
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
