import { getRequiredSkusFromLocationMap } from "./location-map";
import { resolveSku } from "./match";
import type {
  CountEntry,
  CounterLocationAssignment,
  Location,
  LocationGudangMap,
  Sku,
} from "./types";

function norm(value: string): string {
  return value.trim().toLowerCase();
}

export interface SkuTaskStatus {
  sku: string;
  done: boolean;
}

export interface LocationTaskStatus {
  location: string;
  skus: SkuTaskStatus[];
  complete: boolean;
}

/** Assignments tab has at least one row — feature is active. */
export function assignmentsEnforced(
  assignments: CounterLocationAssignment[],
): boolean {
  return assignments.length > 0;
}

/** This session has at least one assignment row. */
export function sessionAssignmentsEnforced(
  sessionId: string,
  assignments: CounterLocationAssignment[],
): boolean {
  if (!assignmentsEnforced(assignments)) return false;
  const sid = norm(sessionId);
  return assignments.some((a) => norm(a.sessionId) === sid);
}

export function getStaffAssignments(
  sessionId: string,
  staffName: string,
  assignments: CounterLocationAssignment[],
): CounterLocationAssignment[] {
  const sid = norm(sessionId);
  const name = norm(staffName);
  return assignments.filter(
    (a) => norm(a.sessionId) === sid && norm(a.name) === name,
  );
}

/** @deprecated Use getStaffAssignments */
export const getCounterAssignments = getStaffAssignments;

/** Locations this staff member may use in this session. */
export function getAllowedLocations(
  sessionId: string,
  staffName: string,
  assignments: CounterLocationAssignment[],
  allLocations: Location[],
): Location[] {
  if (!sessionAssignmentsEnforced(sessionId, assignments)) {
    return allLocations;
  }
  const mine = getStaffAssignments(sessionId, staffName, assignments);
  if (mine.length === 0) return [];
  const allowed = new Set(mine.map((a) => norm(a.location)));
  const fromMaster = allLocations.filter((l) => allowed.has(norm(l.name)));
  const masterNames = new Set(fromMaster.map((l) => norm(l.name)));
  for (const row of mine) {
    if (!masterNames.has(norm(row.location))) {
      fromMaster.push({ name: row.location });
    }
  }
  return fromMaster.sort((a, b) => a.name.localeCompare(b.name));
}

export function getRequiredSkusForLocation(
  sessionId: string,
  staffName: string,
  locationName: string,
  assignments: CounterLocationAssignment[],
  locationMap: LocationGudangMap[] = [],
): string[] | null {
  const rows = getStaffAssignments(sessionId, staffName, assignments).filter(
    (a) => norm(a.location) === norm(locationName),
  );
  if (rows.length === 0) return null;

  const fromLocationMap = getRequiredSkusFromLocationMap(
    locationName,
    locationMap,
  );
  if (fromLocationMap.length > 0) return fromLocationMap;

  const legacySkus = [
    ...new Set(rows.map((r) => r.sku.trim()).filter(Boolean)),
  ];
  if (legacySkus.length === 0) return null;
  return legacySkus;
}

export function isLocationAllowedForCounter(
  sessionId: string,
  counterName: string,
  locationName: string,
  assignments: CounterLocationAssignment[],
): boolean {
  if (!sessionAssignmentsEnforced(sessionId, assignments)) return true;
  const mine = getStaffAssignments(sessionId, counterName, assignments);
  if (mine.length === 0) return false;
  const loc = norm(locationName);
  return mine.some((a) => norm(a.location) === loc);
}

function skuCodesMatch(a: string, b: string, catalog: Sku[]): boolean {
  if (norm(a) === norm(b)) return true;
  const left = resolveSku(a, catalog);
  const right = resolveSku(b, catalog);
  if (left && right && norm(left.sku) === norm(right.sku)) return true;
  return false;
}

export function isSkuAllowedAtLocation(
  sessionId: string,
  staffName: string,
  locationName: string,
  skuCode: string,
  assignments: CounterLocationAssignment[],
  catalog: Sku[] = [],
  locationMap: LocationGudangMap[] = [],
): boolean {
  const required = getRequiredSkusForLocation(
    sessionId,
    staffName,
    locationName,
    assignments,
    locationMap,
  );
  if (!required) return true;
  return required.some((req) => skuCodesMatch(req, skuCode, catalog));
}

export function locationAssignmentError(
  sessionId: string,
  counterName: string,
  assignments: CounterLocationAssignment[],
): string {
  if (
    sessionAssignmentsEnforced(sessionId, assignments) &&
    getStaffAssignments(sessionId, counterName, assignments).length === 0
  ) {
    return "No locations assigned to you for this session. Ask your supervisor.";
  }
  return "This location is not assigned to you for this session.";
}

export function skuAssignmentError(
  sessionId: string,
  staffName: string,
  locationName: string,
  assignments: CounterLocationAssignment[],
  locationMap: LocationGudangMap[] = [],
): string {
  const required = getRequiredSkusForLocation(
    sessionId,
    staffName,
    locationName,
    assignments,
    locationMap,
  );
  if (!required?.length) return "This SKU is not valid here.";
  return `Only these SKUs are required here: ${required.join(", ")}`;
}

function countCoversSku(
  entry: CountEntry,
  sessionId: string,
  staffName: string,
  locationName: string,
  sku: string,
  catalog: Sku[],
): boolean {
  return (
    entry.sessionId === sessionId &&
    norm(entry.counter) === norm(staffName) &&
    norm(entry.location) === norm(locationName) &&
    skuCodesMatch(entry.sku, sku, catalog)
  );
}

/** Task list per location with SKU completion from this staff member's counts. */
export function buildStaffLocationTasks(
  sessionId: string,
  staffName: string,
  assignments: CounterLocationAssignment[],
  counts: CountEntry[],
  catalog: Sku[] = [],
  locationMap: LocationGudangMap[] = [],
): LocationTaskStatus[] {
  const mine = getStaffAssignments(sessionId, staffName, assignments);
  if (mine.length === 0) return [];

  const locations = [
    ...new Set(mine.map((row) => row.location.trim()).filter(Boolean)),
  ];

  const sessionCounts = counts.filter(
    (c) =>
      c.sessionId === sessionId && norm(c.counter) === norm(staffName),
  );

  const tasks: LocationTaskStatus[] = [];
  for (const location of locations) {
    const requiredSkus = getRequiredSkusForLocation(
      sessionId,
      staffName,
      location,
      assignments,
      locationMap,
    );
    if (!requiredSkus?.length) {
      const visited = sessionCounts.some(
        (c) => norm(c.location) === norm(location),
      );
      tasks.push({ location, skus: [], complete: visited });
      continue;
    }

    const skuStatuses: SkuTaskStatus[] = requiredSkus.map((sku) => ({
      sku,
      done: sessionCounts.some((c) =>
        countCoversSku(c, sessionId, staffName, location, sku, catalog),
      ),
    }));
    tasks.push({
      location,
      skus: skuStatuses,
      complete: skuStatuses.every((s) => s.done),
    });
  }

  return tasks.sort((a, b) => a.location.localeCompare(b.location));
}
