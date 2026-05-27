export type SessionStatus = "open" | "closed" | "planned" | string;

export interface StockSession {
  id: string;
  name: string;
  status: SessionStatus;
  pinRequired: boolean;
}

export interface Counter {
  name: string;
}

export interface Location {
  name: string;
}

/** LocationMap tab: physical scan location → warehouse (gudang). */
export interface LocationGudangMap {
  location: string;
  gudang: string;
}

export interface SkuGudangTotal {
  sku: string;
  gudang: string;
  quantity: number;
}

export interface SkuGudangVariance {
  sku: string;
  gudang: string;
  counted: number;
  system: number;
  variance: number;
}

export interface SystemStockRow {
  rowIndex: number;
  sessionId: string;
  sku: string;
  gudang: string;
  quantity: number;
}

/**
 * One row on the Assignments sheet (session_id, location, name, optional sku).
 * Multiple rows per location with different skus = multiple SKUs to count there.
 */
export interface CounterLocationAssignment {
  sessionId: string;
  location: string;
  name: string;
  sku: string;
}

export interface Sku {
  sku: string;
  name: string;
  code: string;
}

export interface CountEntry {
  rowIndex: number;
  countId: string;
  timestamp: string;
  sessionId: string;
  counter: string;
  location: string;
  sku: string;
  quantity: number;
  deviceId: string;
}

export interface BootstrapData {
  sessions: StockSession[];
  counters: Counter[];
  locations: Location[];
  skus: Sku[];
  assignments: CounterLocationAssignment[];
  locationMap: LocationGudangMap[];
}

export interface DashboardMetrics {
  sessionId: string;
  sessionName: string;
  locationsScanned: number;
  locationsTotal: number;
  skusScanned: number;
  skusTotal: number;
  totalLines: number;
  totalQuantity: number;
  activeCounters: number;
  recentCounts: CountEntry[];
  topLocations: { name: string; lines: number }[];
  topCounters: { name: string; lines: number }[];
  expectedSkuCount: number;
  countedSkuCount: number;
  matchedSkuCount: number;
  missingSkuCount: number;
  extraSkuCount: number;
  totalExpectedQty: number;
  totalCountedQtyForMatchedSkus: number;
  totalGapQty: number;
  sessionStockSheetTitle: string | null;
  stockGapPreview: StockGapRow[];
  /** Physical counts rolled up via LocationMap. */
  countedBySkuGudang: SkuGudangTotal[];
  systemStockBySkuGudang: SkuGudangTotal[];
  variances: SkuGudangVariance[];
  unmappedLocations: string[];
}

export interface DeviceSession {
  sessionId: string;
  sessionName: string;
  counterName: string;
  startedAt: string;
}

export interface SessionStockRow {
  gudang: string;
  sku: string;
  expectedQty: number;
  countedQty: number;
  gapQty: number;
  variancePct: number;
  lastUpdated: string;
}

export interface StockGapRow {
  gudang: string;
  sku: string;
  expectedQty: number;
  countedQty: number;
  gapQty: number;
  variancePct: number;
}
