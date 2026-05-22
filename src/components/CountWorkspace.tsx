"use client";

import { useState } from "react";
import { ScanField } from "@/components/ScanField";
import { SkuScanField } from "@/components/SkuScanField";
import { CountHistory } from "@/components/CountHistory";
import { Button, Card, ErrorBanner, SuccessBanner } from "@/components/ui";
import { apiFetch } from "@/lib/count-api";
import { getDeviceId } from "@/lib/device";
import { resolveLocation } from "@/lib/match";
import {
  clearActiveLocation,
  saveActiveLocation,
} from "@/lib/session-store";
import type { BootstrapData, DeviceSession } from "@/lib/types";

export function CountWorkspace({
  deviceSession,
  bootstrap,
  activeLocation,
  onLocationChange,
  onHistoryChange,
}: {
  deviceSession: DeviceSession;
  bootstrap: BootstrapData;
  activeLocation: string | null;
  onLocationChange: (code: string | null) => void;
  onHistoryChange: () => void;
}) {
  const [pickingLocation, setPickingLocation] = useState(!activeLocation);
  const [locationInput, setLocationInput] = useState("");
  const [skuInput, setSkuInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  function confirmLocation() {
    const name = locationInput.trim();
    if (!name) {
      setError("Scan or enter a location first.");
      return;
    }
    const match = resolveLocation(name, bootstrap.locations);
    if (!match) {
      setError("Location not found.");
      return;
    }
    saveActiveLocation(match.name);
    onLocationChange(match.name);
    setLocationInput("");
    setPickingLocation(false);
    setError(null);
    setSuccess(`Location set: ${match.name}`);
  }

  function changeLocation() {
    clearActiveLocation();
    onLocationChange(null);
    setPickingLocation(true);
    setLocationInput("");
    setSkuInput("");
    setQuantityInput("");
    setSuccess(null);
    setError(null);
  }

  async function submitCount() {
    if (!activeLocation) {
      setError("Set a location before counting.");
      return;
    }
    if (!skuInput.trim()) {
      setError("Scan or enter a SKU.");
      return;
    }
    const qty = Number(quantityInput);
    if (Number.isNaN(qty) || qty < 0) {
      setError("Enter a valid quantity.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch("/api/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: deviceSession.sessionId,
          counterName: deviceSession.counterName,
          locationName: activeLocation,
          skuCode: skuInput.trim(),
          quantity: qty,
          deviceId: getDeviceId(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save count");
      setSuccess(
        `Saved ${data.resolved.sku} × ${qty} @ ${data.resolved.location}`,
      );
      setSkuInput("");
      setQuantityInput("");
      setHistoryKey((k) => k + 1);
      onHistoryChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  const locationDisplay = activeLocation;

  return (
    <div className="space-y-4">
      {pickingLocation || !activeLocation ? (
        <Card>
          <ScanField
            label="Set location"
            placeholder="Scan or type location name"
            value={locationInput}
            onChange={setLocationInput}
            onSubmit={confirmLocation}
            autoFocus
          />
          <Button type="button" className="mt-3" onClick={confirmLocation}>
            Lock location
          </Button>
        </Card>
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-4 border-b border-teal-200 bg-teal-50/95 px-4 py-3 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
              Active location
            </p>
            <p className="text-xl font-semibold text-teal-950">
              {locationDisplay}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="mt-2 !min-h-10"
              onClick={changeLocation}
            >
              Change location
            </Button>
          </div>

          <Card className="space-y-4">
            <SkuScanField
              skus={bootstrap.skus}
              value={skuInput}
              onChange={setSkuInput}
              autoFocus
            />
            <div>
              <label className="mb-2 block text-sm font-medium text-stone-800">
                Quantity
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="w-full rounded-xl border border-stone-300 px-4 py-3 text-2xl outline-none ring-teal-600 focus:ring-2"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitCount();
                }}
              />
            </div>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => void submitCount()}
            >
              {submitting ? "Saving…" : "Save count"}
            </Button>
          </Card>
        </>
      )}

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      <CountHistory
        deviceSession={deviceSession}
        bootstrap={bootstrap}
        refreshKey={historyKey}
      />
    </div>
  );
}
