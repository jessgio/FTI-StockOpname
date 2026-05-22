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
}

export interface DeviceSession {
  sessionId: string;
  sessionName: string;
  counterName: string;
  startedAt: string;
}
