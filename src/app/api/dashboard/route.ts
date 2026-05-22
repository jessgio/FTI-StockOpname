import { NextResponse } from "next/server";
import { requireSessionToken } from "@/lib/require-session-token";
import { fetchDashboard } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sessionId = new URL(request.url).searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId query parameter is required" },
        { status: 400 },
      );
    }

    const authError = requireSessionToken(request, sessionId);
    if (authError) return authError;

    const metrics = await fetchDashboard(sessionId);
    return NextResponse.json(metrics);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
