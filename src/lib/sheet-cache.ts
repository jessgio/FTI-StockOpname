import type { BootstrapData, CountEntry } from "./types";

const BOOTSTRAP_TTL_MS = 45_000;
const COUNTS_TTL_MS = 20_000;

let bootstrapCache: { data: BootstrapData; expiresAt: number } | null = null;
let countsCache: {
  entries: CountEntry[];
  byId: Map<string, CountEntry>;
  expiresAt: number;
} | null = null;

const sheetIdCache = new Map<string, number>();

export function getCachedBootstrap(): BootstrapData | null {
  if (!bootstrapCache || Date.now() >= bootstrapCache.expiresAt) return null;
  return bootstrapCache.data;
}

export function setCachedBootstrap(data: BootstrapData) {
  bootstrapCache = { data, expiresAt: Date.now() + BOOTSTRAP_TTL_MS };
}

export function invalidateBootstrapCache() {
  bootstrapCache = null;
}

export function getCachedCounts(): CountEntry[] | null {
  if (!countsCache || Date.now() >= countsCache.expiresAt) return null;
  return countsCache.entries;
}

export function getCachedCountById(countId: string): CountEntry | undefined {
  if (!countsCache || Date.now() >= countsCache.expiresAt) return undefined;
  return countsCache.byId.get(countId);
}

export function setCachedCounts(entries: CountEntry[]) {
  const byId = new Map<string, CountEntry>();
  for (const entry of entries) {
    if (entry.countId) byId.set(entry.countId, entry);
  }
  countsCache = {
    entries,
    byId,
    expiresAt: Date.now() + COUNTS_TTL_MS,
  };
}

export function invalidateCountsCache() {
  countsCache = null;
}

export function invalidateAllCaches() {
  invalidateBootstrapCache();
  invalidateCountsCache();
}

export function getCachedSheetId(tab: string): number | undefined {
  return sheetIdCache.get(tab);
}

export function setCachedSheetId(tab: string, sheetId: number) {
  sheetIdCache.set(tab, sheetId);
}
