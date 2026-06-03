export const sheetConfig = {
  spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID ?? "",
  sessions: process.env.SHEET_SESSIONS ?? "Sessions",
  counters: process.env.SHEET_COUNTERS ?? "Counters",
  locations: process.env.SHEET_LOCATIONS ?? "Locations",
  skus: process.env.SHEET_SKUS ?? "SKUs",
  counts: process.env.SHEET_COUNTS ?? "Counts",
  assignments: process.env.SHEET_ASSIGNMENTS ?? "Assignments",
  opnamePrefix: process.env.SHEET_OPNAME_PREFIX ?? "SO_",
  locationMap: process.env.SHEET_LOCATION_MAP ?? "LocationMap",
  systemStock: process.env.SHEET_SYSTEM_STOCK ?? "SystemStock",
} as const;

/** 1-based column letters → index helpers are in sheets.ts */
export const columnMaps = {
  sessions: {
    id: Number(process.env.COL_SESSION_ID ?? 0),
    name: Number(process.env.COL_SESSION_NAME ?? 1),
    status: Number(process.env.COL_SESSION_STATUS ?? 2),
    pin: Number(process.env.COL_SESSION_PIN ?? 3),
  },
  counters: {
    name: Number(process.env.COL_COUNTER_NAME ?? 0),
  },
  locations: {
    name: Number(process.env.COL_LOCATION_NAME ?? 0),
  },
  skus: {
    sku: Number(process.env.COL_SKU_CODE ?? 0),
    name: Number(process.env.COL_SKU_NAME ?? 1),
    code: Number(process.env.COL_SKU_BARCODE ?? 2),
  },
  assignments: {
    sessionId: Number(process.env.COL_ASSIGNMENT_SESSION_ID ?? 0),
    location: Number(process.env.COL_ASSIGNMENT_LOCATION ?? 1),
    name: Number(process.env.COL_ASSIGNMENT_NAME ?? 2),
    sku: Number(process.env.COL_ASSIGNMENT_SKU ?? 3),
  },
  locationMap: {
    location: Number(process.env.COL_LOCATION_MAP_LOCATION ?? 0),
    gudang: Number(process.env.COL_LOCATION_MAP_GUDANG ?? 1),
    sku: Number(process.env.COL_LOCATION_MAP_SKU ?? 2),
  },
  systemStock: {
    sessionId: Number(process.env.COL_SYSTEM_STOCK_SESSION_ID ?? 0),
    sku: Number(process.env.COL_SYSTEM_STOCK_SKU ?? 1),
    gudang: Number(process.env.COL_SYSTEM_STOCK_GUDANG ?? 2),
    quantity: Number(process.env.COL_SYSTEM_STOCK_QTY ?? 3),
  },
  counts: [
    "timestamp",
    "session_id",
    "counter",
    "location",
    "sku",
    "quantity",
    "device_id",
  ] as const,
};

export function getServiceAccountCredentials(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  }
}

export function assertSheetConfig() {
  if (!sheetConfig.spreadsheetId) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not set");
  }
}
