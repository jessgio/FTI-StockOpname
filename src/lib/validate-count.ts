import {
  getAllowedLocations,
  isLocationAllowedForCounter,
  isSkuAllowedAtLocation,
  locationAssignmentError,
  skuAssignmentError,
} from "./assignments";
import { isSameCounter } from "./counter-auth";
import { normalizeCode, resolveCounter, resolveLocation, resolveSku } from "./match";
import type { BootstrapData, CountEntry } from "./types";

export async function validateCountInput(
  bootstrap: BootstrapData,
  input: {
    sessionId: string;
    counterName: string;
    locationName: string;
    skuCode: string;
    quantity: number;
  },
) {
  const counter = resolveCounter(input.counterName, bootstrap.counters);
  if (!counter) throw new Error("Unknown counter");

  const allowedLocations = getAllowedLocations(
    input.sessionId,
    counter.name,
    bootstrap.assignments,
    bootstrap.locations,
  );
  const location = resolveLocation(input.locationName, allowedLocations);
  const skuCode = input.skuCode.trim();
  let sku = resolveSku(skuCode, bootstrap.skus);

  if (!location) throw new Error("Unknown location");
  if (
    !isLocationAllowedForCounter(
      input.sessionId,
      counter.name,
      location.name,
      bootstrap.assignments,
    )
  ) {
    throw new Error(
      locationAssignmentError(
        input.sessionId,
        counter.name,
        bootstrap.assignments,
      ),
    );
  }
  // If a SKU is assigned for this location but missing from the SKUs tab, we still allow it.
  if (!sku) {
    const allowed = isSkuAllowedAtLocation(
      input.sessionId,
      counter.name,
      location.name,
      skuCode,
      bootstrap.assignments,
      bootstrap.skus,
      bootstrap.locationMap,
    );
    if (!allowed) throw new Error("Unknown SKU");
    sku = {
      sku: skuCode,
      name: "",
      code: normalizeCode(skuCode),
    };
  }
  if (
    !isSkuAllowedAtLocation(
      input.sessionId,
      counter.name,
      location.name,
      sku.sku,
      bootstrap.assignments,
      bootstrap.skus,
      bootstrap.locationMap,
    )
  ) {
    throw new Error(
      skuAssignmentError(
        input.sessionId,
        counter.name,
        location.name,
        bootstrap.assignments,
        bootstrap.locationMap,
      ),
    );
  }
  if (input.quantity < 0) throw new Error("Quantity must be zero or positive");

  return {
    counter,
    location,
    sku,
    quantity: input.quantity,
  };
}

export function assertCounterOwnsRow(
  entry: CountEntry,
  counterName: string,
  sessionId: string,
) {
  if (entry.sessionId !== sessionId) {
    throw new Error("Count does not belong to this session");
  }
  if (!isSameCounter(entry.counter, counterName)) {
    throw new Error("You can only edit or delete your own counts");
  }
}
