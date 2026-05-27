"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScanField } from "@/components/ScanField";
import { SkuScanField } from "@/components/SkuScanField";
import { apiFetch } from "@/lib/count-api";
import {
  getAllowedLocations,
  getRequiredSkusForLocation,
  isSkuAllowedAtLocation,
  locationAssignmentError,
  sessionAssignmentsEnforced,
  skuAssignmentError,
} from "@/lib/assignments";
import { resolveLocation, resolveSku } from "@/lib/match";
import { buildSkusForScan } from "@/lib/sku-list";
import { Button, Card } from "./ui";
import type { BootstrapData, CountEntry, DeviceSession } from "@/lib/types";

type EditDraft = {
  location: string;
  sku: string;
  quantity: string;
};

export function CountHistory({
  deviceSession,
  bootstrap,
  refreshKey,
  onCountsChange,
}: {
  deviceSession: DeviceSession;
  bootstrap: BootstrapData;
  refreshKey: number;
  onCountsChange?: () => void;
}) {
  const [history, setHistory] = useState<CountEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const editRequiredSkus = useMemo(() => {
    if (!draft?.location.trim()) return null;
    return getRequiredSkusForLocation(
      deviceSession.sessionId,
      deviceSession.counterName,
      draft.location.trim(),
      bootstrap.assignments,
    );
  }, [
    draft?.location,
    deviceSession.sessionId,
    deviceSession.counterName,
    bootstrap.assignments,
  ]);

  const editSkusForScan = useMemo(
    () => buildSkusForScan(bootstrap.skus, editRequiredSkus),
    [bootstrap.skus, editRequiredSkus],
  );

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sessionId: deviceSession.sessionId,
        counter: deviceSession.counterName,
      });
      const res = await apiFetch(`/api/history?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load history");
      setHistory(data.history as CountEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [deviceSession.sessionId, deviceSession.counterName]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshKey]);

  function startEdit(entry: CountEntry) {
    if (!entry.countId) {
      setError("This older line has no ID — delete and re-count if needed.");
      return;
    }
    setEditingId(entry.countId);
    setDraft({
      location: entry.location,
      sku: entry.sku,
      quantity: String(entry.quantity),
    });
    setError(null);
  }

  function validateDraft(d: EditDraft): string | null {
    const locationName = d.location.trim();
    const skuTrimmed = d.sku.trim();
    if (!locationName) return "Enter a location.";
    if (!skuTrimmed) return "Enter a SKU.";

    const location = resolveLocation(locationName, allowedLocations);
    if (!location) {
      return assignmentsActive
        ? "That location is not assigned to you."
        : "Location not found.";
    }

    if (editRequiredSkus?.length) {
      if (
        !isSkuAllowedAtLocation(
          deviceSession.sessionId,
          deviceSession.counterName,
          location.name,
          skuTrimmed,
          bootstrap.assignments,
          bootstrap.skus,
        )
      ) {
        return skuAssignmentError(
          deviceSession.sessionId,
          deviceSession.counterName,
          location.name,
          bootstrap.assignments,
        );
      }
    } else {
      const resolved = resolveSku(skuTrimmed, bootstrap.skus);
      if (!resolved && bootstrap.skus.length > 0) {
        return "Unknown SKU.";
      }
    }

    const qty = Number(d.quantity);
    if (Number.isNaN(qty) || qty < 0) return "Enter a valid quantity.";
    return null;
  }

  async function saveEdit(entry: CountEntry) {
    if (!draft || !entry.countId) return;
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    const qty = Number(draft.quantity);
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/count", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countId: entry.countId,
          sessionId: deviceSession.sessionId,
          counterName: deviceSession.counterName,
          locationName: draft.location.trim(),
          skuCode: draft.sku.trim(),
          quantity: qty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      setEditingId(null);
      setDraft(null);
      await loadHistory();
      onCountsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry: CountEntry) {
    if (!entry.countId) {
      setError("This older line has no ID — cannot delete from the app.");
      return;
    }
    if (!confirm(`Delete ${entry.sku} × ${entry.quantity} @ ${entry.location}?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/count", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countId: entry.countId,
          sessionId: deviceSession.sessionId,
          counterName: deviceSession.counterName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      if (editingId === entry.countId) {
        setEditingId(null);
        setDraft(null);
      }
      await loadHistory();
      onCountsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  function skuLabel(sku: string) {
    const item = bootstrap.skus.find(
      (s) => s.sku === sku || s.name.toLowerCase() === sku.toLowerCase(),
    );
    return item?.name ?? sku;
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Your counts this session</h2>
        <button
          type="button"
          className="text-sm font-medium text-teal-800"
          onClick={() => void loadHistory()}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-stone-600">Loading history…</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-stone-600">No counts yet. Add your first above.</p>
      ) : (
        <ul className="space-y-3">
          {history.map((entry) => (
            <li
              key={entry.countId || `row-${entry.rowIndex}`}
              className="rounded-xl border border-stone-200 bg-stone-50 p-3"
            >
              {editingId === entry.countId && draft ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Edit count
                  </p>
                  <ScanField
                    label="Location"
                    placeholder="Scan or type location"
                    value={draft.location}
                    onChange={(location) =>
                      setDraft((prev) =>
                        prev ? { ...prev, location } : prev,
                      )
                    }
                  />
                  <SkuScanField
                    skus={editSkusForScan}
                    value={draft.sku}
                    onChange={(sku) =>
                      setDraft((prev) => (prev ? { ...prev, sku } : prev))
                    }
                  />
                  <div>
                    <label className="mb-2 block text-sm font-medium text-stone-800">
                      Quantity
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-lg outline-none ring-teal-600 focus:ring-2"
                      value={draft.quantity}
                      onChange={(e) =>
                        setDraft({ ...draft, quantity: e.target.value })
                      }
                    />
                  </div>
                  {assignmentsActive && !allowedLocations.length ? (
                    <p className="text-sm text-amber-800">
                      {locationAssignmentError(
                        deviceSession.sessionId,
                        deviceSession.counterName,
                        bootstrap.assignments,
                      )}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveEdit(entry)}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setEditingId(null);
                        setDraft(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-medium text-stone-900">
                    {entry.sku}{" "}
                    <span className="font-normal text-stone-600">
                      ({skuLabel(entry.sku)})
                    </span>
                  </p>
                  <p className="text-sm text-stone-600">
                    × {entry.quantity} @ {entry.location}
                  </p>
                  <p className="text-xs text-stone-500">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy || !entry.countId}
                      onClick={() => startEdit(entry)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={busy || !entry.countId}
                      onClick={() => void remove(entry)}
                    >
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
