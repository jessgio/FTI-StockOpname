"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AssignmentTaskList } from "@/components/AssignmentTaskList";
import { ScanField } from "@/components/ScanField";
import { SkuScanField } from "@/components/SkuScanField";
import { CountHistory } from "@/components/CountHistory";
import { Button, Card, ErrorBanner, SuccessBanner } from "@/components/ui";
import { apiFetch } from "@/lib/count-api";
import { getDeviceId } from "@/lib/device";
import {
  buildStaffLocationTasks,
  getAllowedLocations,
  getRequiredSkusForLocation,
  getStaffAssignments,
  isSkuAllowedAtLocation,
  locationAssignmentError,
  sessionAssignmentsEnforced,
  skuAssignmentError,
} from "@/lib/assignments";
import { resolveGudang } from "@/lib/location-map";
import { resolveLocation, resolveSku } from "@/lib/match";
import { buildSkusForScan } from "@/lib/sku-list";
import {
  clearActiveLocation,
  saveActiveLocation,
} from "@/lib/session-store";
import type { BootstrapData, CountEntry, DeviceSession } from "@/lib/types";

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
  const [myCounts, setMyCounts] = useState<CountEntry[]>([]);

  const allowedLocations = useMemo(
    () =>
      getAllowedLocations(
        deviceSession.sessionId,
        deviceSession.counterName,
        bootstrap.assignments,
        bootstrap.locations,
      ),
    [
      deviceSession.sessionId,
      deviceSession.counterName,
      bootstrap.assignments,
      bootstrap.locations,
    ],
  );

  const assignmentsActive = sessionAssignmentsEnforced(
    deviceSession.sessionId,
    bootstrap.assignments,
  );
  const hasAssignedLocations =
    getStaffAssignments(
      deviceSession.sessionId,
      deviceSession.counterName,
      bootstrap.assignments,
    ).length > 0;

  const locationTasks = useMemo(
    () =>
      buildStaffLocationTasks(
        deviceSession.sessionId,
        deviceSession.counterName,
        bootstrap.assignments,
        myCounts,
        bootstrap.skus,
        bootstrap.locationMap,
      ),
    [
      deviceSession.sessionId,
      deviceSession.counterName,
      bootstrap.assignments,
      bootstrap.locationMap,
      myCounts,
      bootstrap.skus,
    ],
  );

  const requiredSkusAtActive = useMemo(() => {
    if (!activeLocation) return null;
    return getRequiredSkusForLocation(
      deviceSession.sessionId,
      deviceSession.counterName,
      activeLocation,
      bootstrap.assignments,
      bootstrap.locationMap,
    );
  }, [
    activeLocation,
    deviceSession.sessionId,
    deviceSession.counterName,
    bootstrap.assignments,
    bootstrap.locationMap,
  ]);

  const skusForScan = useMemo(
    () => buildSkusForScan(bootstrap.skus, requiredSkusAtActive),
    [bootstrap.skus, requiredSkusAtActive],
  );

  const loadMyCounts = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/api/history?sessionId=${encodeURIComponent(deviceSession.sessionId)}&counter=${encodeURIComponent(deviceSession.counterName)}`,
      );
      const data = await res.json();
      if (!res.ok) return;
      setMyCounts((data.history ?? []) as CountEntry[]);
    } catch {
      setMyCounts([]);
    }
  }, [deviceSession.sessionId, deviceSession.counterName]);

  useEffect(() => {
    void loadMyCounts();
  }, [loadMyCounts, historyKey]);

  useEffect(() => {
    if (!activeLocation || !assignmentsActive) return;
    if (!resolveLocation(activeLocation, allowedLocations)) {
      clearActiveLocation();
      onLocationChange(null);
      setPickingLocation(true);
      setError(
        hasAssignedLocations
          ? "Your previous location is no longer assigned to you."
          : locationAssignmentError(
              deviceSession.sessionId,
              deviceSession.counterName,
              bootstrap.assignments,
            ),
      );
    }
  }, [
    activeLocation,
    allowedLocations,
    assignmentsActive,
    hasAssignedLocations,
    deviceSession.sessionId,
    deviceSession.counterName,
    bootstrap.assignments,
    onLocationChange,
  ]);

  function lockLocation(name: string) {
    if (assignmentsActive && !hasAssignedLocations) {
      setError(
        locationAssignmentError(
          deviceSession.sessionId,
          deviceSession.counterName,
          bootstrap.assignments,
        ),
      );
      return;
    }
    const match = resolveLocation(name, allowedLocations);
    if (!match) {
      setError(
        assignmentsActive
          ? "That location is not assigned to you."
          : "Location not found.",
      );
      return;
    }
    saveActiveLocation(match.name);
    onLocationChange(match.name);
    setLocationInput("");
    setPickingLocation(false);
    setError(null);
    setSuccess(`Location set: ${match.name}`);
  }

  function confirmLocation(scannedName?: string) {
    const name = (scannedName ?? locationInput).trim();
    if (!name) {
      setError("Scan or enter a location first.");
      return;
    }
    lockLocation(name);
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

    const skuTrimmed = skuInput.trim();

    if (requiredSkusAtActive?.length) {
      const allowed = isSkuAllowedAtLocation(
        deviceSession.sessionId,
        deviceSession.counterName,
        activeLocation,
        skuTrimmed,
        bootstrap.assignments,
        bootstrap.skus,
        bootstrap.locationMap,
      );
      if (!allowed) {
        setError(
          skuAssignmentError(
            deviceSession.sessionId,
            deviceSession.counterName,
            activeLocation,
            bootstrap.assignments,
            bootstrap.locationMap,
          ),
        );
        return;
      }
    } else {
      const resolved = resolveSku(skuTrimmed, bootstrap.skus);
      if (!resolved && bootstrap.skus.length > 0) {
        setError("Unknown SKU.");
        return;
      }
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
          skuCode: skuTrimmed,
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
      await loadMyCounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  const activeGudang = activeLocation
    ? resolveGudang(activeLocation, bootstrap.locationMap)
    : undefined;

  const showTaskList = assignmentsActive && locationTasks.length > 0;

  return (
    <div className="space-y-4">
      {showTaskList ? (
        <Card className="!bg-stone-50/80">
          <AssignmentTaskList
            tasks={locationTasks}
            skus={bootstrap.skus}
            activeLocation={activeLocation}
            selectable={pickingLocation || !activeLocation}
            onSelectLocation={(loc) => lockLocation(loc)}
          />
        </Card>
      ) : null}

      {pickingLocation || !activeLocation ? (
        <Card>
          {assignmentsActive && hasAssignedLocations ? (
            <p className="mb-3 text-sm text-stone-600">
              Tap one of your locations above, or scan its QR code below.
            </p>
          ) : null}
          <ScanField
            label="Set location"
            placeholder="Scan or type location name"
            value={locationInput}
            onChange={setLocationInput}
            onSubmit={(value) => confirmLocation(value)}
            autoFocus={!showTaskList}
          />
          {!showTaskList ? (
            <Button
              type="button"
              className="mt-3"
              onClick={() => confirmLocation()}
            >
              Lock location
            </Button>
          ) : null}
        </Card>
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-4 border-b border-teal-200 bg-teal-50/95 px-4 py-3 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
              Active location
            </p>
            <p className="text-xl font-semibold text-teal-950">
              {activeLocation}
            </p>
            {activeGudang ? (
              <p className="mt-1 text-sm text-teal-800">
                Counts roll up to <strong>{activeGudang}</strong>
              </p>
            ) : bootstrap.locationMap.length > 0 ? (
              <p className="mt-1 text-sm text-amber-800">
                No gudang mapped for this location — ask your supervisor.
              </p>
            ) : null}
            {requiredSkusAtActive?.length ? (
              <p className="mt-1 text-sm text-stone-600">
                Required SKUs: {requiredSkusAtActive.join(", ")}
              </p>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="mt-2 !min-h-10"
              onClick={changeLocation}
            >
              Change location
            </Button>
          </div>

          <Card className="space-y-4 overflow-visible">
            <SkuScanField
              skus={skusForScan}
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
        onCountsChange={() => {
          setHistoryKey((k) => k + 1);
          void loadMyCounts();
        }}
      />
    </div>
  );
}
