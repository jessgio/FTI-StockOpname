"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "./ui";
import type { Sku } from "@/lib/types";

const QrScanner = dynamic(
  () => import("./QrScanner").then((m) => m.QrScanner),
  { ssr: false },
);

const MAX_SUGGESTIONS = 12;

function filterSkus(skus: Sku[], query: string): Sku[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return skus
    .filter(
      (s) =>
        s.sku.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q),
    )
    .slice(0, MAX_SUGGESTIONS);
}

export function SkuScanField({
  skus,
  value,
  onChange,
  autoFocus,
}: {
  skus: Sku[];
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(() => filterSkus(skus, value), [skus, value]);

  useEffect(() => {
    setHighlight(0);
  }, [value, suggestions.length]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function selectSku(sku: Sku) {
    onChange(sku.sku);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      const picked = suggestions[highlight];
      if (picked) selectSku(picked);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="space-y-3" ref={containerRef}>
      <label className="block text-sm font-medium text-stone-800" htmlFor={listId}>
        SKU
      </label>
      {scanning ? (
        <QrScanner
          onScan={(code) => {
            onChange(code);
            setScanning(false);
            setOpen(false);
          }}
          onClose={() => setScanning(false)}
        />
      ) : (
        <>
          <div className="relative">
            <input
              id={listId}
              role="combobox"
              aria-expanded={open && suggestions.length > 0}
              aria-controls={`${listId}-listbox`}
              aria-autocomplete="list"
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-lg outline-none ring-teal-600 focus:ring-2"
              placeholder="Type to search SKU or scan barcode"
              value={value}
              autoFocus={autoFocus}
              autoComplete="off"
              onChange={(e) => {
                onChange(e.target.value);
                setOpen(true);
              }}
              onFocus={() => value.trim() && setOpen(true)}
              onKeyDown={onKeyDown}
            />
            {open && suggestions.length > 0 ? (
              <ul
                id={`${listId}-listbox`}
                role="listbox"
                className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
              >
                {suggestions.map((sku, index) => (
                  <li key={`${sku.sku}-${sku.code}`} role="option">
                    <button
                      type="button"
                      role="presentation"
                      aria-selected={index === highlight}
                      className={`w-full px-4 py-2.5 text-left text-sm ${
                        index === highlight
                          ? "bg-teal-50 text-teal-950"
                          : "text-stone-800 hover:bg-stone-50"
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSku(sku)}
                    >
                      <span className="font-medium">{sku.sku}</span>
                      {sku.name ? (
                        <span className="ml-2 text-stone-500">{sku.name}</span>
                      ) : null}
                      {sku.code && sku.code !== sku.sku.toUpperCase() ? (
                        <span className="mt-0.5 block text-xs text-stone-400">
                          {sku.code}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {value.trim() && suggestions.length === 0 && skus.length > 0 ? (
            <p className="text-xs text-stone-500">No matching SKUs in the list.</p>
          ) : null}
          <Button type="button" onClick={() => setScanning(true)}>
            Scan QR
          </Button>
        </>
      )}
    </div>
  );
}
