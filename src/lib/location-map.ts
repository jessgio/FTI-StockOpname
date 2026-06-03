import type { Location, LocationGudangMap } from "./types";

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
  const row = locationMap.find(
    (m) => norm(m.location) === needle && m.gudang.trim(),
  );
  return row?.gudang.trim();
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

/** Required SKUs for a location from LocationMap column C (one row per SKU). */
export function getRequiredSkusFromLocationMap(
  locationName: string,
  locationMap: LocationGudangMap[],
): string[] {
  const loc = norm(locationName);
  return [
    ...new Set(
      locationMap
        .filter((r) => norm(r.location) === loc && r.sku.trim())
        .map((r) => r.sku.trim()),
    ),
  ];
}

/** Unique scan locations from LocationMap rows (column A). */
export function locationsFromLocationMap(
  locationMap: LocationGudangMap[],
): Location[] {
  const seen = new Set<string>();
  const result: Location[] = [];
  for (const row of locationMap) {
    const name = row.location.trim();
    if (!name) continue;
    const key = norm(name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/** Merge Locations tab names with LocationMap registry (map wins for ordering). */
export function mergeLocationLists(
  fromLocationsTab: Location[],
  locationMap: LocationGudangMap[],
): Location[] {
  const seen = new Set<string>();
  const result: Location[] = [];

  for (const row of locationMap) {
    const name = row.location.trim();
    if (!name) continue;
    const key = norm(name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name });
  }

  for (const loc of fromLocationsTab) {
    const name = loc.name.trim();
    if (!name) continue;
    const key = norm(name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}
