"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AppShell,
  Card,
  ErrorBanner,
  NavLink,
  ProgressBar,
  StatTile,
} from "@/components/ui";
import type { BootstrapData, DashboardMetrics } from "@/lib/types";

export default function DashboardPage() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBootstrap = useCallback(async () => {
    const res = await fetch("/api/bootstrap");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load sessions");
    const parsed = data as BootstrapData;
    setBootstrap(parsed);
    const firstOpen = parsed.sessions.find((s) => s.status !== "closed");
    if (firstOpen && !sessionId) setSessionId(firstOpen.id);
    return parsed;
  }, [sessionId]);

  const loadMetrics = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?sessionId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load metrics");
      setMetrics(data as DashboardMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadBootstrap();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      }
    })();
  }, [loadBootstrap]);

  useEffect(() => {
    if (sessionId) void loadMetrics(sessionId);
  }, [sessionId, loadMetrics]);

  const sessions = bootstrap?.sessions ?? [];

  return (
    <AppShell title="Dashboard" subtitle="Live progress from your count sheet">
      <div className="flex gap-2">
        <NavLink href="/">Home</NavLink>
        <NavLink href="/count">Count</NavLink>
      </div>

      <Card>
        <label className="mb-2 block text-sm font-medium text-stone-800">
          Session
        </label>
        <select
          className="w-full rounded-xl border border-stone-300 px-3 py-3 text-base"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        >
          <option value="">Select session</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.status})
            </option>
          ))}
        </select>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <Card>
          <p className="text-stone-600">Loading metrics…</p>
        </Card>
      ) : metrics ? (
        <>
          <Card className="space-y-4">
            <h2 className="text-lg font-medium">{metrics.sessionName}</h2>
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
                {metrics.recentCounts.map((row, i) => (
                  <li
                    key={`${row.timestamp}-${i}`}
                    className="rounded-lg bg-stone-50 px-3 py-2"
                  >
                    <span className="font-medium">{row.sku}</span> × {row.quantity}{" "}
                    <span className="text-stone-600">
                      @ {row.location} · {row.counter}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <button
            type="button"
            className="text-sm font-medium text-teal-800"
            onClick={() => void loadMetrics(sessionId)}
          >
            Refresh metrics
          </button>
        </>
      ) : null}
    </AppShell>
  );
}
