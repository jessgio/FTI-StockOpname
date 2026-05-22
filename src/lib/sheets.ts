import { google, sheets_v4 } from "googleapis";
import {
  assertSheetConfig,
  columnMaps,
  getServiceAccountCredentials,
  sheetConfig,
} from "./config";
import { isSameCounter } from "./counter-auth";
import { indexCode, normalizeCode, resolveCounter, resolveLocation, resolveSku } from "./match";
import { pinsMatch } from "./pin-auth";
import {
  getCachedBootstrap,
  getCachedCountById,
  getCachedCounts,
  getCachedSheetId,
  invalidateCountsCache,
  setCachedBootstrap,
  setCachedCounts,
  setCachedSheetId,
} from "./sheet-cache";

export { resolveCounter, resolveLocation, resolveSku } from "./match";
import type {
  BootstrapData,
  Counter,
  CountEntry,
  DashboardMetrics,
  Location,
  Sku,
  StockSession,
} from "./types";

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

function tabRange(tab: string, cols = "Z"): string {
  return `'${tab.replace(/'/g, "''")}'!A:${cols}`;
}

async function readTab(tab: string): Promise<string[][]> {
  assertSheetConfig();
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: sheetConfig.spreadsheetId,
    range: tabRange(tab),
  });
  const rows = res.data.values ?? [];
  return rows.length > 1 ? rows.slice(1) : [];
}

async function getSheetId(tab: string): Promise<number> {
  const cached = getCachedSheetId(tab);
  if (cached !== undefined) return cached;

  assertSheetConfig();
  const meta = await getSheets().spreadsheets.get({
    spreadsheetId: sheetConfig.spreadsheetId,
    fields: "sheets.properties",
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === tab);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Sheet not found: ${tab}`);
  }
  setCachedSheetId(tab, sheetId);
  return sheetId;
}

function parseCountRow(row: string[], rowIndex: number): CountEntry | null {
  const sessionId = cell(row, 1);
  const location = cell(row, 3);
  const sku = cell(row, 4);
  if (!sessionId || !location || !sku) return null;
  return {
    rowIndex,
    countId: cell(row, 7),
    timestamp: cell(row, 0),
    sessionId,
    counter: cell(row, 2),
    location,
    sku,
    quantity: Number(cell(row, 5)) || 0,
    deviceId: cell(row, 6),
  };
}

export async function fetchBootstrap(): Promise<BootstrapData> {
  const cached = getCachedBootstrap();
  if (cached) return cached;

  const [sessionRows, counterRows, locationRows, skuRows] = await Promise.all([
    readTab(sheetConfig.sessions),
    readTab(sheetConfig.counters),
    readTab(sheetConfig.locations),
    readTab(sheetConfig.skus),
  ]);

  const sm = columnMaps.sessions;
  const cm = columnMaps.counters;
  const lm = columnMaps.locations;
  const km = columnMaps.skus;

  const sessions: StockSession[] = sessionRows
    .map((row) => ({
      id: cell(row, sm.id),
      name: cell(row, sm.name),
      status: cell(row, sm.status).toLowerCase() || "planned",
      pinRequired: Boolean(cell(row, sm.pin)),
    }))
    .filter((s) => s.id && s.name);

  const counters: Counter[] = counterRows
    .map((row) => ({ name: cell(row, cm.name) }))
    .filter((c) => c.name);

  const locations: Location[] = locationRows
    .map((row) => ({ name: cell(row, lm.name) }))
    .filter((l) => l.name);

  const skus: Sku[] = skuRows
    .map((row) => {
      const sku = cell(row, km.sku);
      const barcode = cell(row, km.code);
      return {
        sku,
        name: cell(row, km.name),
        code: normalizeCode(barcode || sku),
      };
    })
    .filter((s) => s.sku || s.code);

  const data = { sessions, counters, locations, skus };
  setCachedBootstrap(data);
  return data;
}

export async function verifySessionPin(
  sessionId: string,
  pin: string,
): Promise<"ok" | "not_required" | "invalid" | "not_found"> {
  assertSheetConfig();
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: sheetConfig.spreadsheetId,
    range: tabRange(sheetConfig.sessions, "E"),
  });
  const rows = res.data.values ?? [];
  const sm = columnMaps.sessions;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (cell(row, sm.id) !== sessionId) continue;
    const expectedPin = cell(row, sm.pin);
    if (!expectedPin) return "not_required";
    if (pinsMatch(pin, expectedPin)) return "ok";
    return "invalid";
  }
  return "not_found";
}

async function loadCountsFromSheet(): Promise<CountEntry[]> {
  assertSheetConfig();
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: sheetConfig.spreadsheetId,
    range: tabRange(sheetConfig.counts, "H"),
  });
  const rows = res.data.values ?? [];
  const entries: CountEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const parsed = parseCountRow(rows[i], i + 1);
    if (parsed) entries.push(parsed);
  }
  return entries;
}

export async function readCounts(): Promise<CountEntry[]> {
  const cached = getCachedCounts();
  if (cached) return cached;

  const entries = await loadCountsFromSheet();
  setCachedCounts(entries);
  return entries;
}

export async function getCountById(
  countId: string,
): Promise<CountEntry | undefined> {
  const cached = getCachedCountById(countId);
  if (cached) return cached;

  const counts = await readCounts();
  return counts.find((c) => c.countId === countId);
}

export async function fetchCounterHistory(
  sessionId: string,
  counterName: string,
): Promise<CountEntry[]> {
  const counts = await readCounts();
  return counts
    .filter(
      (c) =>
        c.sessionId === sessionId && isSameCounter(c.counter, counterName),
    )
    .sort((a, b) => b.rowIndex - a.rowIndex);
}

export async function appendCount(
  entry: Omit<CountEntry, "timestamp" | "rowIndex" | "countId">,
) {
  assertSheetConfig();
  const timestamp = new Date().toISOString();
  const countId = crypto.randomUUID();
  const row = [
    timestamp,
    entry.sessionId,
    entry.counter,
    entry.location,
    entry.sku,
    String(entry.quantity),
    entry.deviceId,
    countId,
  ];
  const res = await getSheets().spreadsheets.values.append({
    spreadsheetId: sheetConfig.spreadsheetId,
    range: tabRange(sheetConfig.counts, "H"),
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
  invalidateCountsCache();

  const updatedRange = res.data.updates?.updatedRange ?? "";
  const rowMatch = updatedRange.match(/!A(\d+)/i);
  const rowIndex = rowMatch ? Number(rowMatch[1]) : 0;
  return {
    rowIndex,
    countId,
    timestamp,
    ...entry,
  } satisfies CountEntry;
}

export async function updateCountById(
  countId: string,
  entry: {
    sessionId: string;
    counter: string;
    location: string;
    sku: string;
    quantity: number;
    deviceId: string;
  },
) {
  assertSheetConfig();
  const existing = await getCountById(countId);
  if (!existing?.countId) throw new Error("Count not found");
  if (!existing.rowIndex) throw new Error("Count row not found");

  const row = [
    existing.timestamp,
    entry.sessionId,
    entry.counter,
    entry.location,
    entry.sku,
    String(entry.quantity),
    entry.deviceId,
    existing.countId,
  ];
  await getSheets().spreadsheets.values.update({
    spreadsheetId: sheetConfig.spreadsheetId,
    range: `'${sheetConfig.counts.replace(/'/g, "''")}'!A${existing.rowIndex}:H${existing.rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
  invalidateCountsCache();
  return {
    ...existing,
    ...entry,
  } satisfies CountEntry;
}

export async function deleteCountById(countId: string) {
  assertSheetConfig();
  const existing = await getCountById(countId);
  if (!existing?.rowIndex) throw new Error("Count not found");

  const sheetId = await getSheetId(sheetConfig.counts);
  await getSheets().spreadsheets.batchUpdate({
    spreadsheetId: sheetConfig.spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: existing.rowIndex - 1,
              endIndex: existing.rowIndex,
            },
          },
        },
      ],
    },
  });
  invalidateCountsCache();
}

export async function fetchDashboard(
  sessionId: string,
  bootstrap?: BootstrapData,
): Promise<DashboardMetrics> {
  const [data, counts] = await Promise.all([
    bootstrap ? Promise.resolve(bootstrap) : fetchBootstrap(),
    readCounts(),
  ]);
  const sessionCounts = counts.filter((c) => c.sessionId === sessionId);
  const session = data.sessions.find((s) => s.id === sessionId);

  const locationCodes = new Set(
    sessionCounts.map((c) => c.location).filter(Boolean),
  );
  const skuCodes = new Set(sessionCounts.map((c) => c.sku).filter(Boolean));
  const counterNames = new Set(
    sessionCounts.map((c) => c.counter).filter(Boolean),
  );

  const locationTotals = new Map<string, number>();
  const counterTotals = new Map<string, number>();
  for (const c of sessionCounts) {
    locationTotals.set(
      c.location,
      (locationTotals.get(c.location) ?? 0) + 1,
    );
    counterTotals.set(c.counter, (counterTotals.get(c.counter) ?? 0) + 1);
  }

  const topLocations = [...locationTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, lines]) => ({ name, lines }));

  const topCounters = [...counterTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, lines]) => ({ name, lines }));

  return {
    sessionId,
    sessionName: session?.name ?? sessionId,
    locationsScanned: locationCodes.size,
    locationsTotal: data.locations.length,
    skusScanned: skuCodes.size,
    skusTotal: data.skus.length,
    totalLines: sessionCounts.length,
    totalQuantity: sessionCounts.reduce((sum, c) => sum + c.quantity, 0),
    activeCounters: counterNames.size,
    recentCounts: sessionCounts.slice(-8).reverse(),
    topLocations,
    topCounters,
  };
}
