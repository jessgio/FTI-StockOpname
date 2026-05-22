import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { fetchBootstrap, readCounts } from "@/lib/sheets";
import { parseExpectedRowsFromExcel, upsertSessionStockSheet } from "@/lib/stock-opname";
import { requireSessionToken } from "@/lib/require-session-token";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const sessionId = String(formData.get("sessionId") ?? "").trim();
    const file = formData.get("file");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Excel file is required" }, { status: 400 });
    }

    const authError = requireSessionToken(request, sessionId);
    if (authError) return authError;

    const bootstrap = await fetchBootstrap();
    const session = bootstrap.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: "Workbook has no sheets" }, { status: 400 });
    }
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      raw: false,
      defval: "",
    });

    if (!jsonRows.length) {
      return NextResponse.json({ error: "Excel sheet has no data rows" }, { status: 400 });
    }

    const hasTersedia = Object.keys(jsonRows[0]).some(
      (key) => key.trim().toLowerCase() === "tersedia",
    );
    if (!hasTersedia) {
      return NextResponse.json(
        { error: 'Excel must include a "Tersedia" column header' },
        { status: 400 },
      );
    }

    const expectedBySku = parseExpectedRowsFromExcel(jsonRows);
    const allCounts = await readCounts();
    const result = await upsertSessionStockSheet(sessionId, expectedBySku, allCounts);

    return NextResponse.json({
      ok: true,
      sessionId,
      sessionName: session.name,
      sheetTitle: result.sheetTitle,
      sourceRows: jsonRows.length,
      uniqueSkus: expectedBySku.size,
      rowsWritten: result.rowsWritten,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import stock opname file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
