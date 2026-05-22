"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./ui";

async function safeStopScanner(scanner: Html5Qrcode) {
  try {
    await scanner.stop();
  } catch {
    /* already stopped or not started */
  }
  try {
    scanner.clear();
  } catch {
    /* ignore */
  }
}

export function QrScanner({
  onScan,
  onClose,
}: {
  onScan: (value: string) => void;
  onClose: () => void;
}) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const [error, setError] = useState<string | null>(null);

  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  useEffect(() => {
    let cancelled = false;
    handledRef.current = false;
    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          if (cancelled || handledRef.current) return;
          handledRef.current = true;
          const value = decoded.trim();
          void (async () => {
            await safeStopScanner(scanner);
            if (cancelled) return;
            onScanRef.current(value);
            onCloseRef.current();
          })();
        },
        () => undefined,
      )
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Camera access failed";
        setError(message);
      });

    return () => {
      cancelled = true;
      const current = scannerRef.current;
      scannerRef.current = null;
      if (current) void safeStopScanner(current);
    };
  }, [regionId]);

  return (
    <div className="space-y-3">
      <div
        id={regionId}
        className="overflow-hidden rounded-xl border border-stone-200 bg-black"
      />
      {error ? (
        <p className="text-sm text-rose-700">
          {error}. Allow camera access or type the code instead.
        </p>
      ) : (
        <p className="text-sm text-stone-600">Point the camera at the QR code.</p>
      )}
      <Button type="button" variant="secondary" onClick={onClose}>
        Cancel scanner
      </Button>
    </div>
  );
}
