"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/count-api";
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
}: {
  deviceSession: DeviceSession;
  bootstrap: BootstrapData;
  refreshKey: number;
}) {
  const [history, setHistory] = useState<CountEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setEditingRow(entry.rowIndex);
    setDraft({
      location: entry.location,
      sku: entry.sku,
      quantity: String(entry.quantity),
    });
    setError(null);
  }

  async function saveEdit(entry: CountEntry) {
    if (!draft) return;
    const qty = Number(draft.quantity);
    if (Number.isNaN(qty) || qty < 0) {
      setError("Enter a valid quantity.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/count", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowIndex: entry.rowIndex,
          sessionId: deviceSession.sessionId,
          counterName: deviceSession.counterName,
          locationName: draft.location.trim(),
          skuCode: draft.sku.trim(),
          quantity: qty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      setEditingRow(null);
      setDraft(null);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry: CountEntry) {
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
          rowIndex: entry.rowIndex,
          sessionId: deviceSession.sessionId,
          counterName: deviceSession.counterName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      if (editingRow === entry.rowIndex) {
        setEditingRow(null);
        setDraft(null);
      }
      await loadHistory();
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
              key={`${entry.rowIndex}-${entry.countId || entry.timestamp}`}
              className="rounded-xl border border-stone-200 bg-stone-50 p-3"
            >
              {editingRow === entry.rowIndex && draft ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    value={draft.location}
                    onChange={(e) =>
                      setDraft({ ...draft, location: e.target.value })
                    }
                    placeholder="Location name"
                  />
                  <input
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    value={draft.sku}
                    onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                    placeholder="SKU"
                  />
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    value={draft.quantity}
                    onChange={(e) =>
                      setDraft({ ...draft, quantity: e.target.value })
                    }
                  />
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
                        setEditingRow(null);
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
                      disabled={busy}
                      onClick={() => startEdit(entry)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={busy}
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
