import { NextResponse } from "next/server";
import {
  appendCount,
  deleteCountRow,
  fetchBootstrap,
  getCountByRow,
  updateCountRow,
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

    const bootstrap = await fetchBootstrap();
    const resolved = await validateCountInput(bootstrap, {
      counterName,
      locationName,
      skuCode,
      quantity: Number(quantity),
    });

    const entry = await appendCount({
      sessionId,
      counter: resolved.counter.name,
      location: resolved.location.name,
      sku: resolved.sku.sku,
      quantity: resolved.quantity,
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
      rowIndex?: number;
      sessionId?: string;
      counterName?: string;
      locationName?: string;
      skuCode?: string;
      quantity?: number;
      deviceId?: string;
    };

    const {
      rowIndex,
      sessionId,
      counterName,
      locationName,
      skuCode,
      quantity,
      deviceId,
    } = body;

    if (
      !rowIndex ||
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

    const existing = await getCountByRow(rowIndex);
    if (!existing) {
      return NextResponse.json({ error: "Count not found" }, { status: 404 });
    }
    assertCounterOwnsRow(existing, counterName, sessionId);

    const bootstrap = await fetchBootstrap();
    const resolved = await validateCountInput(bootstrap, {
      counterName,
      locationName,
      skuCode,
      quantity: Number(quantity),
    });

    const entry = await updateCountRow(rowIndex, {
      sessionId,
      counter: resolved.counter.name,
      location: resolved.location.name,
      sku: resolved.sku.sku,
      quantity: resolved.quantity,
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
      rowIndex?: number;
      sessionId?: string;
      counterName?: string;
    };

    const { rowIndex, sessionId, counterName } = body;
    if (!rowIndex || !sessionId || !counterName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const authError = requireSessionToken(request, sessionId);
    if (authError) return authError;

    const existing = await getCountByRow(rowIndex);
    if (!existing) {
      return NextResponse.json({ error: "Count not found" }, { status: 404 });
    }
    assertCounterOwnsRow(existing, counterName, sessionId);

    await deleteCountRow(rowIndex);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete count";
    const status = message.includes("own") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
