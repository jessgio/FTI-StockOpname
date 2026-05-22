import { NextResponse } from "next/server";
import { fetchBootstrap } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchBootstrap();
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load sheet data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
