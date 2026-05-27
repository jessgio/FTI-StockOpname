import { buildGudangLookup } from "./location-map";
import type {
  CountEntry,
  LocationGudangMap,
  SkuGudangTotal,
  SkuGudangVariance,
  SystemStockRow,
} from "./types";

function skuGudangKey(sku: string, gudang: string): string {
  return `${sku.trim().toLowerCase()}|${gudang.trim().toLowerCase()}`;
}

function addToMap(
  totals: Map<string, SkuGudangTotal>,
  sku: string,
  gudang: string,
  quantity: number,
) {
  if (!sku.trim() || !gudang.trim() || quantity === 0) return;
  const key = skuGudangKey(sku, gudang);
  const existing = totals.get(key);
  if (existing) {
    existing.quantity += quantity;
    return;
  }
  totals.set(key, {
    sku: sku.trim(),
    gudang: gudang.trim(),
    quantity,
  });
}

function mapToSortedTotals(map: Map<string, SkuGudangTotal>): SkuGudangTotal[] {
  return [...map.values()].sort((a, b) => {
    const g = a.gudang.localeCompare(b.gudang);
    if (g !== 0) return g;
    return a.sku.localeCompare(b.sku);
  });
}

/** Roll up count lines to SKU × gudang using LocationMap. */
export function aggregateCountsBySkuGudang(
  counts: CountEntry[],
  locationMap: LocationGudangMap[],
): { totals: SkuGudangTotal[]; unmappedLocations: string[] } {
  const lookup = buildGudangLookup(locationMap);
  const totals = new Map<string, SkuGudangTotal>();
  const unmapped = new Set<string>();

  for (const line of counts) {
    const gudang = lookup.get(line.location.trim().toLowerCase());
    if (!gudang) {
      if (line.location.trim()) unmapped.add(line.location.trim());
      continue;
    }
    addToMap(totals, line.sku, gudang, line.quantity);
  }

  return {
    totals: mapToSortedTotals(totals),
    unmappedLocations: [...unmapped].sort((a, b) => a.localeCompare(b)),
  };
}

export function aggregateSystemStockRows(
  rows: SystemStockRow[],
): SkuGudangTotal[] {
  const totals = new Map<string, SkuGudangTotal>();
  for (const row of rows) {
    addToMap(totals, row.sku, row.gudang, row.quantity);
  }
  return mapToSortedTotals(totals);
}

export function computeSkuGudangVariances(
  counted: SkuGudangTotal[],
  system: SkuGudangTotal[],
): SkuGudangVariance[] {
  const byKey = new Map<string, SkuGudangVariance>();

  for (const row of counted) {
    const key = skuGudangKey(row.sku, row.gudang);
    byKey.set(key, {
      sku: row.sku,
      gudang: row.gudang,
      counted: row.quantity,
      system: 0,
      variance: row.quantity,
    });
  }

  for (const row of system) {
    const key = skuGudangKey(row.sku, row.gudang);
    const existing = byKey.get(key);
    if (existing) {
      existing.system = row.quantity;
      existing.variance = existing.counted - existing.system;
    } else {
      byKey.set(key, {
        sku: row.sku,
        gudang: row.gudang,
        counted: 0,
        system: row.quantity,
        variance: -row.quantity,
      });
    }
  }

  return [...byKey.values()].sort((a, b) => {
    const g = a.gudang.localeCompare(b.gudang);
    if (g !== 0) return g;
    return a.sku.localeCompare(b.sku);
  });
}
