"use client";

import { useMemo, useState } from "react";
import { AppShell, Button, Card, ErrorBanner, NavLink, SuccessBanner } from "@/components/ui";
import { apiFetch } from "@/lib/count-api";
import { clearSessionAuth, saveSessionAuth } from "@/lib/session-store";
import type { BootstrapData, StockSession } from "@/lib/types";

type Step = "session" | "pin" | "upload";

export function AdminOpnameClient({ bootstrap }: { bootstrap: BootstrapData }) {
  const [step, setStep] = useState<Step>("session");
  const [selectedSession, setSelectedSession] = useState<StockSession | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const availableSessions = useMemo(
    () => bootstrap.sessions.filter((s) => s.status !== "closed"),
    [bootstrap.sessions],
  );

  function pickSession(session: StockSession) {
    setSelectedSession(session);
    setFile(null);
    setSuccess(null);
    setError(null);
    clearSessionAuth();
    if (session.pinRequired) {
      setStep("pin");
      return;
    }
    void unlockSession(session, "");
  }

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
      setStep("upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PIN verification failed");
    } finally {
      setVerifyingPin(false);
    }
  }

  async function upload() {
    if (!selectedSession) return;
    if (!file) {
      setError("Drop an Excel file first.");
      return;
    }
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError("Only .xlsx, .xls, or .csv files are accepted.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("sessionId", selectedSession.id);
      formData.append("file", file);
      const res = await apiFetch("/api/opname/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to upload file");
      setSuccess(
        `Imported ${data.uniqueSkuGudangPairs} SKU+Gudang rows from ${data.sourceRows} rows into sheet ${data.sheetTitle}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell
      title="Admin stock import"
      subtitle={
        selectedSession
          ? `Session: ${selectedSession.name}`
          : "Upload system stock file and map to session"
      }
    >
      <div className="flex gap-2">
        <NavLink href="/">Home</NavLink>
        <NavLink href="/count">Count</NavLink>
        <NavLink href="/dashboard">Dashboard</NavLink>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {success ? <SuccessBanner message={success} /> : null}

      {step === "session" ? (
        <Card>
          <h2 className="mb-3 text-lg font-medium">Choose session</h2>
          {availableSessions.length === 0 ? (
            <p className="text-sm text-stone-600">No active sessions found.</p>
          ) : (
            <ul className="space-y-2">
              {availableSessions.map((session) => (
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
          )}
        </Card>
      ) : null}

      {step === "pin" && selectedSession ? (
        <Card className="space-y-4">
          <p className="text-sm text-stone-600">
            Enter the PIN for <strong>{selectedSession.name}</strong>.
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
              if (e.key === "Enter") void unlockSession(selectedSession, pinInput);
            }}
          />
          <Button
            type="button"
            disabled={verifyingPin}
            onClick={() => void unlockSession(selectedSession, pinInput)}
          >
            {verifyingPin ? "Checking…" : "Unlock upload"}
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

      {step === "upload" && selectedSession ? (
        <Card className="space-y-4">
          <p className="text-sm text-stone-700">
            Drop your system stock Excel file. The app sums duplicate SKU rows
            using the <strong>Tersedia</strong> column and writes a session stock
            sheet named <strong>SO_{selectedSession.id}</strong>.
          </p>

          <label
            className={`block rounded-xl border-2 border-dashed p-6 text-center transition ${
              dragging
                ? "border-teal-500 bg-teal-50"
                : "border-stone-300 bg-stone-50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const nextFile = e.dataTransfer.files?.[0] ?? null;
              setFile(nextFile);
            }}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const nextFile = e.currentTarget.files?.[0] ?? null;
                setFile(nextFile);
              }}
            />
            <p className="text-sm text-stone-700">
              {file ? `Selected: ${file.name}` : "Drag & drop file here or click"}
            </p>
          </label>

          <Button type="button" disabled={uploading} onClick={() => void upload()}>
            {uploading ? "Importing…" : "Import to session stock sheet"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setStep("session");
              setSelectedSession(null);
              setFile(null);
              setSuccess(null);
              clearSessionAuth();
            }}
          >
            Change session
          </Button>
        </Card>
      ) : null}
    </AppShell>
  );
}
