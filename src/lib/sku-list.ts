import { normalizeCode, resolveSku } from "./match";
import type { Sku } from "./types";

/** SKUs available for scanning at a location (assignment codes + catalog). */
export function buildSkusForScan(
  catalog: Sku[],
  requiredCodes: string[] | null,
): Sku[] {
  if (!requiredCodes?.length) return catalog;

  const result: Sku[] = [];
  const seen = new Set<string>();

  for (const code of requiredCodes) {
    const trimmed = code.trim();
    if (!trimmed) continue;
    const match = resolveSku(trimmed, catalog);
    const sku: Sku = match ?? {
      sku: trimmed,
      name: "",
      code: normalizeCode(trimmed),
    };
    const key = sku.sku.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(sku);
  }

  return result.length > 0 ? result : catalog;
}
