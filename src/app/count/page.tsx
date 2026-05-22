"use client";

import { useCallback, useEffect, useState } from "react";
import { CountWorkspace } from "@/components/CountWorkspace";
import { ScanField } from "@/components/ScanField";
import {
  AppShell,
  Button,
  Card,
  ErrorBanner,
  NavLink,
  SuccessBanner,
} from "@/components/ui";
import { resolveCounter } from "@/lib/match";
import {
  clearDeviceSession,
  clearSessionAuth,
  isSessionUnlocked,
  loadActiveLocation,
  loadDeviceSession,
  saveDeviceSession,
  saveSessionAuth,
} from "@/lib/session-store";
import type { BootstrapData, DeviceSession, StockSession } from "@/lib/types";

type Step = "session" | "pin" | "counter" | "counting";

export default function CountPage() {
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deviceSession, setDeviceSession] = useState<DeviceSession | null>(null);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("session");
  const [selectedSession, setSelectedSession] = useState<StockSession | null>(
    null,
  );
  const [counterInput, setCounterInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bootstrap");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load data");
      setBootstrap(data as BootstrapData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
    const existing = loadDeviceSession();
    if (existing) {
      setDeviceSession(existing);
      setSelectedSession({
        id: existing.sessionId,
        name: existing.sessionName,
        status: "open",
        pinRequired: true,
      });
      setActiveLocation(loadActiveLocation());
      if (isSessionUnlocked(existing.sessionId)) {
        setStep("counting");
      } else {
        setStep("pin");
      }
    }
  }, [loadBootstrap]);

  const openSessions =
    bootstrap?.sessions.filter((s) => s.status !== "closed") ?? [];

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
      setPinInput("");
      setStep("counter");
      setSuccess(
        session.pinRequired ? "Session unlocked." : "Session ready.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "PIN verification failed");
    } finally {
      setVerifyingPin(false);
    }
  }

  function startSession(session: StockSession) {
    setSelectedSession(session);
    clearSessionAuth();
    setError(null);
    setSuccess(null);
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

  function confirmCounter() {
    if (!bootstrap || !selectedSession) return;
    if (!isSessionUnlocked(selectedSession.id)) {
      setError("Enter the session PIN first.");
      setStep("pin");
      return;
    }
    const code = counterInput.trim();
    if (!code) {
      setError("Enter or scan your name.");
      return;
    }
    const match = resolveCounter(code, bootstrap.counters);
    if (!match) {
      setError("Counter not found. Check the QR or spelling.");
      return;
    }
    const session: DeviceSession = {
      sessionId: selectedSession.id,
      sessionName: selectedSession.name,
      counterName: match.name,
      startedAt: new Date().toISOString(),
    };
    saveDeviceSession(session);
    setDeviceSession(session);
    setActiveLocation(loadActiveLocation());
    setStep("counting");
    setCounterInput("");
    setError(null);
    setSuccess(`Counting as ${match.name}`);
  }

  function endSession() {
    clearDeviceSession();
    setDeviceSession(null);
    setSelectedSession(null);
    setActiveLocation(null);
    setPinInput("");
    setStep("session");
    setSuccess("Session ended on this device.");
    setError(null);
  }

  if (loading) {
    return (
      <AppShell title="Stock count" subtitle="Loading sessions…">
        <Card>
          <p className="text-stone-600">Connecting to Google Sheets…</p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Stock count"
      subtitle={
        deviceSession
          ? `${deviceSession.sessionName} · ${deviceSession.counterName}`
          : selectedSession
            ? selectedSession.name
            : "Start a session, then scan in order"
      }
    >
      <div className="flex gap-2">
        <NavLink href="/">Home</NavLink>
        <NavLink href="/dashboard">Dashboard</NavLink>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      {step === "session" && !deviceSession ? (
        <Card>
          <h2 className="mb-3 text-lg font-medium">Choose session</h2>
          {openSessions.length === 0 ? (
            <p className="text-sm text-stone-600">
              No open sessions found. Add rows on the Sessions tab with status
              &quot;open&quot; or &quot;planned&quot;.
            </p>
          ) : (
            <ul className="space-y-2">
              {openSessions.map((session) => (
                <li key={session.id}>
                  <Button type="button" onClick={() => startSession(session)}>
                    {session.name}
                    <span className="ml-2 text-sm opacity-80">
                      ({session.status}
                      {session.pinRequired ? " · PIN" : ""})
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {step === "pin" && selectedSession && !deviceSession ? (
        <Card className="space-y-4">
          <p className="text-sm text-stone-600">
            Enter the PIN for <strong>{selectedSession.name}</strong> (set on the
            Sessions tab).
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
            {verifyingPin ? "Checking…" : "Unlock session"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSelectedSession(null);
              setStep("session");
              setPinInput("");
              clearSessionAuth();
            }}
          >
            Back to sessions
          </Button>
        </Card>
      ) : null}

      {step === "counter" && !deviceSession ? (
        <Card>
          <ScanField
            label="Your name"
            placeholder="Scan or type your name"
            value={counterInput}
            onChange={setCounterInput}
            onSubmit={confirmCounter}
            autoFocus
          />
          <div className="mt-3 grid gap-2">
            <Button type="button" variant="secondary" onClick={confirmCounter}>
              Start counting
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                clearSessionAuth();
                setStep(selectedSession?.pinRequired ? "pin" : "session");
              }}
            >
              Back
            </Button>
          </div>
        </Card>
      ) : null}

      {deviceSession && bootstrap ? (
        <>
          <CountWorkspace
            deviceSession={deviceSession}
            bootstrap={bootstrap}
            activeLocation={activeLocation}
            onLocationChange={setActiveLocation}
            onHistoryChange={() => undefined}
          />
          <Card>
            <Button type="button" variant="danger" onClick={endSession}>
              End session on this device
            </Button>
          </Card>
        </>
      ) : null}

      <Button type="button" variant="ghost" onClick={() => void loadBootstrap()}>
        Refresh data
      </Button>
    </AppShell>
  );
}
