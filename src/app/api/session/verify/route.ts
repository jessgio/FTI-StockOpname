import { NextResponse } from "next/server";
import { issueSessionToken } from "@/lib/session-auth";
import { verifySessionPin } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      pin?: string;
    };

    const sessionId = body.sessionId?.trim();
    const pin = body.pin ?? "";

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }

    const result = await verifySessionPin(sessionId, pin);

    if (result === "not_found") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (result === "invalid") {
      return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
    }

    const token = issueSessionToken(sessionId);
    return NextResponse.json({
      ok: true,
      token,
      pinRequired: result !== "not_required",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify PIN";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
