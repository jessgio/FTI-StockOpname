import type { Counter, Location, Sku } from "./types";

export function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export function indexCode(explicit: string, ...fallbacks: string[]): string {
  if (explicit.trim()) return normalizeCode(explicit);
  for (const value of fallbacks) {
    if (value.trim()) return normalizeCode(value);
  }
  return "";
}

export function resolveCounter(
  input: string,
  counters: Counter[],
): Counter | undefined {
  const needle = input.trim().toLowerCase();
  if (!needle) return undefined;
  return counters.find((c) => c.name.trim().toLowerCase() === needle);
}

export function resolveLocation(
  input: string,
  locations: Location[],
): Location | undefined {
  const needle = input.trim().toLowerCase();
  if (!needle) return undefined;
  return locations.find((l) => l.name.trim().toLowerCase() === needle);
}

export function resolveSku(code: string, skus: Sku[]): Sku | undefined {
  const normalized = normalizeCode(code);
  const needle = code.trim().toLowerCase();
  return skus.find(
    (s) =>
      s.code === normalized ||
      normalizeCode(s.sku) === normalized ||
      normalizeCode(s.name) === normalized ||
      s.sku.toLowerCase() === needle ||
      s.name.toLowerCase() === needle,
  );
}
