import { NextResponse } from "next/server";
import { requireSessionToken } from "@/lib/require-session-token";
import { fetchCounterHistory } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const counter = searchParams.get("counter");

    if (!sessionId || !counter) {
      return NextResponse.json(
        { error: "sessionId and counter query parameters are required" },
        { status: 400 },
      );
    }

    const authError = requireSessionToken(request, sessionId);
    if (authError) return authError;

    const history = await fetchCounterHistory(sessionId, counter);
    return NextResponse.json({ history });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
