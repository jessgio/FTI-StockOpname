"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "./ui";
import type { Sku } from "@/lib/types";

const QrScanner = dynamic(
  () => import("./QrScanner").then((m) => m.QrScanner),
  { ssr: false },
);

const MAX_SUGGESTIONS = 15;

function rankSku(sku: Sku, query: string): number {
  const q = query.toLowerCase();
  const code = sku.sku.toLowerCase();
  const name = sku.name.toLowerCase();
  const barcode = sku.code.toLowerCase();
  if (!q) return 0;
  if (code === q || barcode === q) return 0;
  if (code.startsWith(q) || barcode.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (code.includes(q) || barcode.includes(q)) return 3;
  if (name.includes(q)) return 4;
  return 99;
}

function filterSkus(skus: Sku[], query: string): Sku[] {
  const q = query.trim().toLowerCase();
  const pool = q
    ? skus.filter(
        (s) =>
          s.sku.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q),
      )
    : [...skus];
  return pool
    .sort((a, b) => rankSku(a, q) - rankSku(b, q) || a.sku.localeCompare(b.sku))
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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(() => filterSkus(skus, value), [skus, value]);
  const showList = open && !scanning;

  useEffect(() => {
    setHighlight(0);
  }, [value, suggestions.length]);

  useEffect(() => {
    if (autoFocus) {
      const t = window.setTimeout(() => setOpen(true), 0);
      return () => window.clearTimeout(t);
    }
  }, [autoFocus]);

  function openDropdown() {
    setOpen(true);
  }

  function selectSku(sku: Sku) {
    onChange(sku.sku);
    setOpen(false);
    inputRef.current?.focus();
  }

  function onBlur() {
    window.setTimeout(() => {
      if (!containerRef.current) return;
      const active = document.activeElement;
      if (!active) return;
      if (!containerRef.current.contains(active)) setOpen(false);
    }, 120);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openDropdown();
      if (suggestions.length > 0) {
        setHighlight((h) => (h + 1) % suggestions.length);
      }
      return;
    }
    if (e.key === "ArrowUp" && showList && suggestions.length > 0) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (e.key === "Enter" && showList && suggestions.length > 0) {
      e.preventDefault();
      const picked = suggestions[highlight];
      if (picked) selectSku(picked);
      return;
    }
    if (e.key === "Escape") {
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
            const matches = filterSkus(skus, code);
            if (matches.length === 1) {
              onChange(matches[0].sku);
              setOpen(false);
            } else if (matches.length > 1) {
              setOpen(true);
            } else {
              setOpen(false);
            }
          }}
          onClose={() => setScanning(false)}
        />
      ) : (
        <>
          <div className="relative">
            <input
              ref={inputRef}
              id={listId}
              role="combobox"
              aria-expanded={showList}
              aria-controls={`${listId}-listbox`}
              aria-autocomplete="list"
              aria-activedescendant={
                showList && suggestions.length > 0
                  ? `${listId}-option-${highlight}`
                  : undefined
              }
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-lg outline-none ring-teal-600 focus:ring-2"
              placeholder={
                skus.length > 0
                  ? "Search SKU, name, or barcode…"
                  : "Type or scan barcode"
              }
              value={value}
              autoFocus={autoFocus}
              autoComplete="off"
              onChange={(e) => {
                onChange(e.target.value);
                openDropdown();
              }}
              onClick={openDropdown}
              onFocus={openDropdown}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
            />

            {showList ? (
              <ul
                id={`${listId}-listbox`}
                role="listbox"
                className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
              >
                {suggestions.length === 0 ? (
                  <li className="px-4 py-2 text-sm text-stone-500">No matches</li>
                ) : (
                  <>
                    {!value.trim() && skus.length > suggestions.length ? (
                      <li className="px-4 py-1.5 text-xs text-stone-500">
                        Showing {suggestions.length} of {skus.length} — type to narrow
                      </li>
                    ) : null}
                    {suggestions.map((sku, index) => (
                      <li
                        key={`${sku.sku}-${sku.code}`}
                        id={`${listId}-option-${index}`}
                        role="option"
                        aria-selected={index === highlight}
                      >
                        <button
                          type="button"
                          tabIndex={-1}
                          className={`w-full px-4 py-2.5 text-left text-sm ${
                            index === highlight
                              ? "bg-teal-50 text-teal-950"
                              : "text-stone-800 hover:bg-stone-50"
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setHighlight(index)}
                          onClick={() => selectSku(sku)}
                        >
                          <span className="font-medium">{sku.sku}</span>
                          {sku.name ? (
                            <span className="ml-2 text-stone-500">{sku.name}</span>
                          ) : null}
                          {sku.code && sku.code !== sku.sku.toUpperCase() ? (
                            <span className="mt-0.5 block text-xs text-stone-400">
                              Barcode: {sku.code}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </>
                )}
              </ul>
            ) : null}
          </div>

          {value.trim() && suggestions.length === 0 && skus.length > 0 ? (
            <p className="text-xs text-stone-500">No matching SKUs in the list.</p>
          ) : skus.length === 0 ? (
            <p className="text-xs text-stone-500">No SKUs available for this location.</p>
          ) : null}

          <Button type="button" onClick={() => setScanning(true)}>
            Scan QR
          </Button>
        </>
      )}
    </div>
  );
}
