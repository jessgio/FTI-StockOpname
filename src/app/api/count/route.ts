import { NextResponse } from "next/server";
import { findDuplicateCount } from "@/lib/duplicate-count";
import {
  appendCount,
  deleteCountById,
  fetchBootstrap,
  getCountById,
  readCounts,
  updateCountById,
} from "@/lib/sheets";
import { requireSessionToken } from "@/lib/require-session-token";
import { assertCounterOwnsRow, validateCountInput } from "@/lib/validate-count";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      counterName?: string;
      locationName?: string;
      skuCode?: string;
      quantity?: number;
      deviceId?: string;
    };

    const {
      sessionId,
      counterName,
      locationName,
      skuCode,
      quantity,
      deviceId,
    } = body;

    if (!sessionId || !counterName || !locationName || !skuCode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const authError = requireSessionToken(request, sessionId);
    if (authError) return authError;

    if (quantity === undefined || Number.isNaN(Number(quantity))) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }

    const qty = Number(quantity);
    if (qty < 0) {
      return NextResponse.json(
        { error: "Quantity must be zero or positive" },
        { status: 400 },
      );
    }

    const [bootstrap, counts] = await Promise.all([
      fetchBootstrap(),
      readCounts(),
    ]);
    const resolved = await validateCountInput(bootstrap, {
      counterName,
      locationName,
      skuCode,
      quantity: qty,
    });

    const duplicate = findDuplicateCount(
      counts,
      sessionId,
      resolved.counter.name,
      resolved.location.name,
      resolved.sku.sku,
    );
    if (duplicate) {
      return NextResponse.json(
        {
          error: `You already counted ${resolved.sku.sku} at ${resolved.location.name} (qty ${duplicate.quantity}). Edit that line or ask another counter to double-check.`,
        },
        { status: 409 },
      );
    }

    const entry = await appendCount({
      sessionId,
      counter: resolved.counter.name,
      location: resolved.location.name,
      sku: resolved.sku.sku,
      quantity: qty,
      deviceId: deviceId ?? "unknown",
    });

    return NextResponse.json({
      ok: true,
      entry,
      resolved: {
        counter: resolved.counter.name,
        location: resolved.location.name,
        sku: resolved.sku.sku,
        skuName: resolved.sku.name,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save count";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      countId?: string;
      sessionId?: string;
      counterName?: string;
      locationName?: string;
      skuCode?: string;
      quantity?: number;
      deviceId?: string;
    };

    const {
      countId,
      sessionId,
      counterName,
      locationName,
      skuCode,
      quantity,
      deviceId,
    } = body;

    if (
      !countId ||
      !sessionId ||
      !counterName ||
      !locationName ||
      !skuCode ||
      quantity === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const authError = requireSessionToken(request, sessionId);
    if (authError) return authError;

    const existing = await getCountById(countId);
    if (!existing) {
      return NextResponse.json({ error: "Count not found" }, { status: 404 });
    }
    assertCounterOwnsRow(existing, counterName, sessionId);

    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty < 0) {
      return NextResponse.json(
        { error: "Quantity must be zero or positive" },
        { status: 400 },
      );
    }

    const [bootstrap, counts] = await Promise.all([
      fetchBootstrap(),
      readCounts(),
    ]);
    const resolved = await validateCountInput(bootstrap, {
      counterName,
      locationName,
      skuCode,
      quantity: qty,
    });

    const duplicate = findDuplicateCount(
      counts,
      sessionId,
      resolved.counter.name,
      resolved.location.name,
      resolved.sku.sku,
      countId,
    );
    if (duplicate) {
      return NextResponse.json(
        {
          error: `Another line already has ${resolved.sku.sku} at ${resolved.location.name} (qty ${duplicate.quantity}).`,
        },
        { status: 409 },
      );
    }

    const entry = await updateCountById(countId, {
      sessionId,
      counter: resolved.counter.name,
      location: resolved.location.name,
      sku: resolved.sku.sku,
      quantity: qty,
      deviceId: deviceId ?? existing.deviceId,
    });

    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update count";
    const status = message.includes("own") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      countId?: string;
      sessionId?: string;
      counterName?: string;
    };

    const { countId, sessionId, counterName } = body;
    if (!countId || !sessionId || !counterName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const authError = requireSessionToken(request, sessionId);
    if (authError) return authError;

    const existing = await getCountById(countId);
    if (!existing) {
      return NextResponse.json({ error: "Count not found" }, { status: 404 });
    }
    assertCounterOwnsRow(existing, counterName, sessionId);

    await deleteCountById(countId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete count";
    const status = message.includes("own") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
