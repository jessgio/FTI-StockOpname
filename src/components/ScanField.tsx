"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "./ui";

const QrScanner = dynamic(
  () => import("./QrScanner").then((m) => m.QrScanner),
  { ssr: false },
);

export function ScanField({
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  autoFocus,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** Called with the scanned/entered value (avoids stale state after QR scan). */
  onSubmit?: (value: string) => void;
  autoFocus?: boolean;
}) {
  const [scanning, setScanning] = useState(false);

  function submitWithValue(nextValue?: string) {
    const resolved = (nextValue ?? value).trim();
    if (!resolved) return;
    onChange(resolved);
    onSubmit?.(resolved);
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-stone-800">{label}</label>
      {scanning ? (
        <QrScanner
          onScan={(code) => {
            onChange(code);
            onSubmit?.(code);
          }}
          onClose={() => setScanning(false)}
        />
      ) : (
        <>
          <input
            className="w-full rounded-xl border border-stone-300 px-4 py-3 text-lg outline-none ring-teal-600 focus:ring-2"
            placeholder={placeholder}
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitWithValue();
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" onClick={() => setScanning(true)}>
              Scan QR
            </Button>
            {onSubmit ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => submitWithValue()}
              >
                Continue
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
