import {
  isLocationAllowedForCounter,
  isSkuAllowedAtLocation,
  locationAssignmentError,
  skuAssignmentError,
} from "./assignments";
import { isSameCounter } from "./counter-auth";
import { resolveCounter, resolveLocation, resolveSku } from "./match";
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
  const location = resolveLocation(input.locationName, bootstrap.locations);
  const sku = resolveSku(input.skuCode, bootstrap.skus);

  if (!counter) throw new Error("Unknown counter");
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
  if (!sku) throw new Error("Unknown SKU");
  if (
    !isSkuAllowedAtLocation(
      input.sessionId,
      counter.name,
      location.name,
      sku.sku,
      bootstrap.assignments,
      bootstrap.skus,
    )
  ) {
    throw new Error(
      skuAssignmentError(
        input.sessionId,
        counter.name,
        location.name,
        bootstrap.assignments,
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
