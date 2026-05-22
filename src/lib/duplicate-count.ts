import { isSameCounter } from "./counter-auth";
import type { CountEntry } from "./types";

function norm(value: string): string {
  return value.trim().toLowerCase();
}

export function findDuplicateCount(
  counts: CountEntry[],
  sessionId: string,
  counter: string,
  location: string,
  sku: string,
  excludeCountId?: string,
): CountEntry | undefined {
  return counts.find(
    (c) =>
      c.sessionId === sessionId &&
      isSameCounter(c.counter, counter) &&
      norm(c.location) === norm(location) &&
      norm(c.sku) === norm(sku) &&
      (!excludeCountId || c.countId !== excludeCountId),
  );
}
