import { google, sheets_v4 } from "googleapis";
import { assertSheetConfig, getServiceAccountCredentials, sheetConfig } from "./config";
import type { CountEntry, SessionStockRow, StockGapRow } from "./types";

const STOCK_HEADERS = [
  "gudang",
  "sku",
  "expected_qty",
  "counted_qty",
  "gap_qty",
  "variance_pct",
  "last_updated",
];

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheets(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;
  const auth = new google.auth.GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

function cell(row: string[], index: number): string {
  return (row[index] ?? "").trim();
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeSheetTitle(title: string): string {
  return title.replace(/[\\/?*[\]:]/g, "_").slice(0, 100);
}

function tabRange(tab: string, range = "A:G"): string {
  return `'${tab.replace(/'/g, "''")}'!${range}`;
}

function sessionStockTabName(sessionId: string): string {
  return sanitizeSheetTitle(`${sheetConfig.opnamePrefix}${sessionId}`);
}

function calculateVariancePct(expectedQty: number, gapQty: number): number {
  if (expectedQty === 0) return 0;
  return Number(((gapQty / expectedQty) * 100).toFixed(2));
}

async function readLocationMap(): Promise<Map<string, string>> {
  assertSheetConfig();
  const response = await getSheets().spreadsheets.values.get({
    spreadsheetId: sheetConfig.spreadsheetId,
    range: tabRange(sheetConfig.locationMap, "A:B"),
  });
  const rows = response.data.values ?? [];
  if (rows.length <= 1) return new Map();

  const mappings = new Map<string, string>();
  for (let i = 1; i < rows.length; i += 1) {
    const sourceLocation = cell(rows[i], 0);
    const gudang = cell(rows[i], 1);
    if (!sourceLocation || !gudang) continue;
    mappings.set(sourceLocation.toLowerCase(), gudang);
  }
  return mappings;
}

async function getSheetIdIfExists(tab: string): Promise<number | null> {
  assertSheetConfig();
  const meta = await getSheets().spreadsheets.get({
    spreadsheetId: sheetConfig.spreadsheetId,
    fields: "sheets.properties",
  });
  const found = meta.data.sheets?.find((s) => s.properties?.title === tab);
  return found?.properties?.sheetId ?? null;
}

async function ensureSessionSheet(tab: string): Promise<void> {
  const existing = await getSheetIdIfExists(tab);
  if (existing !== null) return;

  assertSheetConfig();
  await getSheets().spreadsheets.batchUpdate({
    spreadsheetId: sheetConfig.spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: tab,
            },
          },
        },
      ],
    },
  });
}

function aggregateCountedByGudangSku(
  counts: CountEntry[],
  sessionId: string,
  locationMap: Map<string, string>,
): Map<string, number> {
  const grouped = new Map<string, number>();
  for (const row of counts) {
    if (row.sessionId !== sessionId) continue;
    const sku = row.sku.trim();
    const mappedGudang = locationMap.get(row.location.trim().toLowerCase());
    if (!sku) continue;
    if (!mappedGudang) continue;
    const key = `${mappedGudang}|||${sku}`;
    grouped.set(key, (grouped.get(key) ?? 0) + row.quantity);
  }
  return grouped;
}

async function readSessionStockRows(tab: string): Promise<SessionStockRow[]> {
  assertSheetConfig();
  const response = await getSheets().spreadsheets.values.get({
    spreadsheetId: sheetConfig.spreadsheetId,
    range: tabRange(tab, "A:G"),
  });
  const rows = response.data.values ?? [];
  if (rows.length <= 1) return [];

  const parsed: SessionStockRow[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const gudang = cell(row, 0);
    const sku = cell(row, 1);
    if (!sku) continue;
    parsed.push({
      gudang: gudang || "UNMAPPED",
      sku,
      expectedQty: toNumber(cell(row, 2)),
      countedQty: toNumber(cell(row, 3)),
      gapQty: toNumber(cell(row, 4)),
      variancePct: toNumber(cell(row, 5)),
      lastUpdated: cell(row, 6),
    });
  }
  return parsed;
}

function buildStockRows(
  expectedByGudangSku: Map<string, number>,
  countedByGudangSku: Map<string, number>,
): SessionStockRow[] {
  const allKeys = new Set<string>([...expectedByGudangSku.keys()]);
  const now = new Date().toISOString();
  return [...allKeys]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const [gudang, sku] = key.split("|||");
      const expectedQty = expectedByGudangSku.get(key) ?? 0;
      const countedQty = countedByGudangSku.get(key) ?? 0;
      const gapQty = countedQty - expectedQty;
      return {
        gudang: gudang || "UNMAPPED",
        sku,
        expectedQty,
        countedQty,
        gapQty,
        variancePct: calculateVariancePct(expectedQty, gapQty),
        lastUpdated: now,
      };
    });
}

async function writeStockRows(tab: string, rows: SessionStockRow[]): Promise<void> {
  assertSheetConfig();
  const bodyRows = rows.map((row) => [
    row.gudang,
    row.sku,
    String(row.expectedQty),
    String(row.countedQty),
    String(row.gapQty),
    String(row.variancePct),
    row.lastUpdated,
  ]);
  await getSheets().spreadsheets.values.update({
    spreadsheetId: sheetConfig.spreadsheetId,
    range: tabRange(tab, "A:G"),
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [STOCK_HEADERS, ...bodyRows],
    },
  });
}

export function parseExpectedRowsFromExcel(
  rows: Array<Record<string, unknown>>,
): Map<string, number> {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const sku = String(row["SKU"] ?? row["sku"] ?? row["Sku"] ?? "").trim();
    const gudang = String(
      row["Lokasi"] ?? row["lokasi"] ?? row["LOKASI"] ?? "UNMAPPED",
    ).trim();
    if (!sku) continue;
    if (!gudang) continue;
    if (sku.toUpperCase().startsWith("BND-")) continue;
    const available = row["Tersedia"];
    const qty = Number(String(available ?? "").replace(/,/g, ""));
    const safeQty = Number.isFinite(qty) ? qty : 0;
    const key = `${gudang}|||${sku}`;
    grouped.set(key, (grouped.get(key) ?? 0) + safeQty);
  }
  return grouped;
}

export async function upsertSessionStockSheet(
  sessionId: string,
  expectedByGudangSku: Map<string, number>,
  allCounts: CountEntry[],
): Promise<{ sheetTitle: string; rowsWritten: number }> {
  const tab = sessionStockTabName(sessionId);
  await ensureSessionSheet(tab);
  const locationMap = await readLocationMap();
  const countedByGudangSku = aggregateCountedByGudangSku(
    allCounts,
    sessionId,
    locationMap,
  );
  const rows = buildStockRows(expectedByGudangSku, countedByGudangSku);
  await writeStockRows(tab, rows);
  return { sheetTitle: tab, rowsWritten: rows.length };
}

export async function refreshSessionStockFromCounts(
  sessionId: string,
  allCounts: CountEntry[],
): Promise<void> {
  const tab = sessionStockTabName(sessionId);
  const sheetId = await getSheetIdIfExists(tab);
  if (sheetId === null) return;

  const existingRows = await readSessionStockRows(tab);
  const expectedByGudangSku = new Map(
    existingRows.map((r) => [`${r.gudang}|||${r.sku}`, r.expectedQty]),
  );
  const locationMap = await readLocationMap();
  const countedByGudangSku = aggregateCountedByGudangSku(
    allCounts,
    sessionId,
    locationMap,
  );
  const rows = buildStockRows(expectedByGudangSku, countedByGudangSku);
  await writeStockRows(tab, rows);
}

export async function getSessionStockGap(
  sessionId: string,
): Promise<{
  sheetTitle: string | null;
  rows: SessionStockRow[];
  preview: StockGapRow[];
  expectedSkuCount: number;
  countedSkuCount: number;
  matchedSkuCount: number;
  missingSkuCount: number;
  extraSkuCount: number;
  totalExpectedQty: number;
  totalCountedQtyForMatchedSkus: number;
  totalGapQty: number;
}> {
  const tab = sessionStockTabName(sessionId);
  const sheetId = await getSheetIdIfExists(tab);
  if (sheetId === null) {
    return {
      sheetTitle: null,
      rows: [],
      preview: [],
      expectedSkuCount: 0,
      countedSkuCount: 0,
      matchedSkuCount: 0,
      missingSkuCount: 0,
      extraSkuCount: 0,
      totalExpectedQty: 0,
      totalCountedQtyForMatchedSkus: 0,
      totalGapQty: 0,
    };
  }

  const rows = await readSessionStockRows(tab);
  const expectedRows = rows.filter((r) => r.expectedQty > 0);
  const countedRows = rows.filter((r) => r.countedQty > 0);
  const matchedRows = rows.filter((r) => r.expectedQty > 0 && r.countedQty > 0);
  const missingRows = rows.filter((r) => r.expectedQty > 0 && r.countedQty === 0);
  const extraRows = rows.filter((r) => r.expectedQty === 0 && r.countedQty > 0);
  const totalExpectedQty = expectedRows.reduce((sum, r) => sum + r.expectedQty, 0);
  const totalCountedQtyForMatchedSkus = matchedRows.reduce(
    (sum, r) => sum + r.countedQty,
    0,
  );
  const totalGapQty = rows.reduce((sum, r) => sum + r.gapQty, 0);
  const preview = [...rows]
    .sort((a, b) => Math.abs(b.gapQty) - Math.abs(a.gapQty))
    .slice(0, 20)
    .map((r) => ({
      gudang: r.gudang,
      sku: r.sku,
      expectedQty: r.expectedQty,
      countedQty: r.countedQty,
      gapQty: r.gapQty,
      variancePct: r.variancePct,
    }));

  return {
    sheetTitle: tab,
    rows,
    preview,
    expectedSkuCount: expectedRows.length,
    countedSkuCount: countedRows.length,
    matchedSkuCount: matchedRows.length,
    missingSkuCount: missingRows.length,
    extraSkuCount: extraRows.length,
    totalExpectedQty,
    totalCountedQtyForMatchedSkus,
    totalGapQty,
  };
}
