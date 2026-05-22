"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AppShell,
  Button,
  Card,
  ErrorBanner,
  NavLink,
  ProgressBar,
  StatTile,
} from "@/components/ui";
import { apiFetch } from "@/lib/count-api";
import {
  clearSessionAuth,
  isSessionUnlocked,
  loadSessionAuth,
  saveSessionAuth,
} from "@/lib/session-store";
import type { BootstrapData, DashboardMetrics, StockSession } from "@/lib/types";

type Step = "session" | "pin" | "metrics";

export default function DashboardPage() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [step, setStep] = useState<Step>("session");
  const [selectedSession, setSelectedSession] = useState<StockSession | null>(
    null,
  );
  const [sessionId, setSessionId] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBootstrap = useCallback(async () => {
    const res = await fetch("/api/bootstrap");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load sessions");
    const parsed = data as BootstrapData;
    setBootstrap(parsed);
    return parsed;
  }, []);

  const loadMetrics = useCallback(async (id: string) => {
    if (!id) return;
    if (!isSessionUnlocked(id)) {
      setStep("pin");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/dashboard?sessionId=${encodeURIComponent(id)}`,
      );
      const data = await res.json();
      if (res.status === 401) {
        clearSessionAuth();
        setStep("pin");
        throw new Error(data.error ?? "Session PIN required");
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to load metrics");
      setMetrics(data as DashboardMetrics);
      setStep("metrics");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const parsed = await loadBootstrap();
        const auth = loadSessionAuth();
        if (auth?.sessionId) {
          setSessionId(auth.sessionId);
          const session = parsed.sessions.find((s) => s.id === auth.sessionId);
          if (session) setSelectedSession(session);
          if (isSessionUnlocked(auth.sessionId)) {
            await loadMetrics(auth.sessionId);
          } else {
            setStep("pin");
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      }
    })();
  }, [loadBootstrap, loadMetrics]);

  async function unlockSession(session: StockSession, pin: string) {
    setVerifyingPin(true);
    setError(null);
    try {
      const res = await fetch("/api/session/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "PIN verification failed");
      saveSessionAuth({ sessionId: session.id, token: data.token });
      setSessionId(session.id);
      setSelectedSession(session);
      setPinInput("");
      await loadMetrics(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PIN verification failed");
    } finally {
      setVerifyingPin(false);
    }
  }

  function pickSession(session: StockSession) {
    setSelectedSession(session);
    setSessionId(session.id);
    clearSessionAuth();
    setMetrics(null);
    setError(null);
    if (session.pinRequired) {
      setStep("pin");
    } else {
      void unlockSession(session, "");
    }
  }

  function confirmPin() {
    if (!selectedSession) return;
    if (!pinInput.trim()) {
      setError("Enter the session PIN.");
      return;
    }
    void unlockSession(selectedSession, pinInput);
  }

  function lockDashboard() {
    clearSessionAuth();
    setMetrics(null);
    setStep(selectedSession?.pinRequired ? "pin" : "session");
    setPinInput("");
  }

  const sessions = bootstrap?.sessions ?? [];

  return (
    <AppShell
      title="Dashboard"
      subtitle={
        selectedSession
          ? selectedSession.name
          : "Unlock a session to view progress"
      }
    >
      <div className="flex gap-2">
        <NavLink href="/">Home</NavLink>
        <NavLink href="/count">Count</NavLink>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {step === "session" ? (
        <Card>
          <h2 className="mb-3 text-lg font-medium">Choose session</h2>
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <Button type="button" onClick={() => pickSession(session)}>
                  {session.name}
                  <span className="ml-2 text-sm opacity-80">
                    ({session.status}
                    {session.pinRequired ? " · PIN" : ""})
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {step === "pin" && selectedSession ? (
        <Card className="space-y-4">
          <p className="text-sm text-stone-600">
            Enter the session PIN for <strong>{selectedSession.name}</strong>{" "}
            (same PIN used for counting).
          </p>
          <label className="block text-sm font-medium text-stone-800">
            Session PIN
          </label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-2xl tracking-widest outline-none ring-teal-600 focus:ring-2"
            value={pinInput}
            autoFocus
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmPin();
            }}
          />
          <Button
            type="button"
            disabled={verifyingPin}
            onClick={() => confirmPin()}
          >
            {verifyingPin ? "Checking…" : "Unlock dashboard"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSelectedSession(null);
              setSessionId("");
              setStep("session");
              clearSessionAuth();
            }}
          >
            Back to sessions
          </Button>
        </Card>
      ) : null}

      {step === "metrics" && loading ? (
        <Card>
          <p className="text-stone-600">Loading metrics…</p>
        </Card>
      ) : null}

      {step === "metrics" && metrics ? (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-stone-600">
              Viewing <strong>{metrics.sessionName}</strong>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-sm font-medium text-teal-800"
                onClick={() => void loadMetrics(sessionId)}
              >
                Refresh
              </button>
              <button
                type="button"
                className="text-sm font-medium text-stone-600"
                onClick={lockDashboard}
              >
                Lock
              </button>
            </div>
          </Card>

          <Card className="space-y-4">
            <ProgressBar
              label="Locations scanned"
              current={metrics.locationsScanned}
              total={metrics.locationsTotal}
            />
            <ProgressBar
              label="SKUs counted"
              current={metrics.skusScanned}
              total={metrics.skusTotal}
            />
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Count lines" value={metrics.totalLines} />
            <StatTile label="Total qty" value={metrics.totalQuantity} />
            <StatTile
              label="Active counters"
              value={metrics.activeCounters}
              hint="People who submitted counts"
            />
            <StatTile
              label="Coverage"
              value={`${metrics.locationsTotal ? Math.round((metrics.locationsScanned / metrics.locationsTotal) * 100) : 0}%`}
              hint="Locations with at least one line"
            />
          </div>

          <Card>
            <h3 className="mb-2 font-medium">Stock gap monitor</h3>
            {metrics.sessionStockSheetTitle ? (
              <>
                <p className="mb-3 text-sm text-stone-600">
                  Tracking against sheet <strong>{metrics.sessionStockSheetTitle}</strong>.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <StatTile
                    label="Expected SKUs"
                    value={metrics.expectedSkuCount}
                    hint="From uploaded Tersedia totals"
                  />
                  <StatTile
                    label="Counted SKUs"
                    value={metrics.countedSkuCount}
                    hint="Any SKU with count > 0"
                  />
                  <StatTile
                    label="Matched SKUs"
                    value={metrics.matchedSkuCount}
                    hint="Expected and counted"
                  />
                  <StatTile
                    label="Missing SKUs"
                    value={metrics.missingSkuCount}
                    hint="Expected but not counted"
                  />
                  <StatTile
                    label="Extra SKUs"
                    value={metrics.extraSkuCount}
                    hint="Counted but not expected"
                  />
                  <StatTile
                    label="Net gap qty"
                    value={metrics.totalGapQty}
                    hint="Counted minus expected"
                  />
                </div>
                <p className="mt-3 text-xs text-stone-500">
                  Expected qty: {metrics.totalExpectedQty} · Counted qty (matched
                  SKUs): {metrics.totalCountedQtyForMatchedSkus}
                </p>
              </>
            ) : (
              <p className="text-sm text-stone-600">
                No stock baseline uploaded for this session yet. Import from{" "}
                <strong>/admin/opname</strong> first.
              </p>
            )}
          </Card>

          {metrics.stockGapPreview.length > 0 ? (
            <Card>
              <h3 className="mb-2 font-medium">Largest SKU+Gudang gaps</h3>
              <ul className="space-y-1 text-sm">
                {metrics.stockGapPreview.map((row) => (
                  <li
                    key={`${row.gudang}-${row.sku}`}
                    className="flex items-center justify-between border-b border-stone-100 py-2"
                  >
                    <span className="font-medium">
                      {row.sku} <span className="text-stone-500">@ {row.gudang}</span>
                    </span>
                    <span className="text-stone-600">
                      Expected {row.expectedQty} · Counted {row.countedQty} · Gap{" "}
                      <strong>{row.gapQty}</strong> · Variance{" "}
                      <strong>{row.variancePct}%</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <h3 className="mb-2 font-medium">Top locations</h3>
            {metrics.topLocations.length === 0 ? (
              <p className="text-sm text-stone-600">No counts yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {metrics.topLocations.map((row) => (
                  <li
                    key={row.name}
                    className="flex justify-between border-b border-stone-100 py-2"
                  >
                    <span>{row.name}</span>
                    <span className="text-stone-600">{row.lines} lines</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="mb-2 font-medium">Top counters</h3>
            {metrics.topCounters.length === 0 ? (
              <p className="text-sm text-stone-600">No counters yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {metrics.topCounters.map((row) => (
                  <li
                    key={row.name}
                    className="flex justify-between border-b border-stone-100 py-2"
                  >
                    <span>{row.name}</span>
                    <span className="text-stone-600">{row.lines} lines</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="mb-2 font-medium">Recent counts</h3>
            {metrics.recentCounts.length === 0 ? (
              <p className="text-sm text-stone-600">Waiting for first entry…</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {metrics.recentCounts.map((row) => (
                  <li
                    key={row.countId || `${row.timestamp}-${row.rowIndex}`}
                    className="rounded-lg bg-stone-50 px-3 py-2"
                  >
                    <span className="font-medium">{row.sku}</span> ×{" "}
                    {row.quantity}{" "}
                    <span className="text-stone-600">
                      @ {row.location} · {row.counter}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </AppShell>
  );
}
