import type { LocationGudangMap } from "./types";

function norm(value: string): string {
  return value.trim().toLowerCase();
}

/** Case-insensitive lookup: location name → gudang. */
export function resolveGudang(
  locationName: string,
  locationMap: LocationGudangMap[],
): string | undefined {
  const needle = norm(locationName);
  if (!needle) return undefined;
  const row = locationMap.find((m) => norm(m.location) === needle);
  return row?.gudang;
}

export function buildGudangLookup(
  locationMap: LocationGudangMap[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of locationMap) {
    if (!row.location.trim() || !row.gudang.trim()) continue;
    map.set(norm(row.location), row.gudang.trim());
  }
  return map;
}
