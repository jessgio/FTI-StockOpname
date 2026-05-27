import { NextResponse } from "next/server";
import { parseSystemStockCsv } from "@/lib/parse-stock-csv";
import { requireSessionToken } from "@/lib/require-session-token";
import { replaceSystemStockForSession } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let sessionId = "";
    let csvText = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      sessionId = String(form.get("sessionId") ?? "").trim();
      const file = form.get("file");
      if (file instanceof File) {
        csvText = await file.text();
      } else {
        csvText = String(form.get("csv") ?? "");
      }
    } else {
      const body = (await request.json()) as {
        sessionId?: string;
        csv?: string;
      };
      sessionId = String(body.sessionId ?? "").trim();
      csvText = String(body.csv ?? "");
    }

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const authError = requireSessionToken(request, sessionId);
    if (authError) return authError;

    if (!csvText.trim()) {
      return NextResponse.json(
        { error: "Upload a CSV file (sku, gudang, quantity columns)." },
        { status: 400 },
      );
    }

    const lines = parseSystemStockCsv(csvText);
    if (lines.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid rows found. Use columns sku, gudang, quantity (header row recommended).",
        },
        { status: 400 },
      );
    }

    await replaceSystemStockForSession(sessionId, lines);

    return NextResponse.json({
      ok: true,
      rowsImported: lines.length,
      skuGudangPairs: new Set(
        lines.map((l) => `${l.sku}|${l.gudang}`.toLowerCase()),
      ).size,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload system stock";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
