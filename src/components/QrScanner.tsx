"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./ui";

export function QrScanner({
  onScan,
  onClose,
}: {
  onScan: (value: string) => void;
  onClose: () => void;
}) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const scanner = new Html5Qrcode(regionId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          if (!active) return;
          active = false;
          void scanner.stop().finally(() => {
            onScan(decoded.trim());
            onClose();
          });
        },
        () => undefined,
      )
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Camera access failed";
        setError(message);
      });

    return () => {
      active = false;
      const current = scannerRef.current;
      if (!current) return;
      void current.stop().catch(() => undefined);
      try {
        current.clear();
      } catch {
        /* ignore */
      }
    };
  }, [onClose, onScan, regionId]);

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
