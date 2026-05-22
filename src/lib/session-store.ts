import type { DeviceSession } from "./types";

const KEY = "fti-device-session";
const LOCATION_KEY = "fti-active-location";
const AUTH_KEY = "fti-session-auth";

export type SessionAuth = {
  sessionId: string;
  token: string;
};

export function loadDeviceSession(): DeviceSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DeviceSession & { counterCode?: string };
    if (!parsed.counterName && parsed.counterCode) {
      parsed.counterName = parsed.counterCode;
    }
    if (!parsed.sessionId || !parsed.counterName) return null;
    return {
      sessionId: parsed.sessionId,
      sessionName: parsed.sessionName,
      counterName: parsed.counterName,
      startedAt: parsed.startedAt,
    };
  } catch {
    return null;
  }
}

export function saveDeviceSession(session: DeviceSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearDeviceSession() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LOCATION_KEY);
  localStorage.removeItem(AUTH_KEY);
}

export function loadSessionAuth(): SessionAuth | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionAuth;
    if (!parsed.sessionId || !parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSessionAuth(auth: SessionAuth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearSessionAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export function isSessionUnlocked(sessionId: string): boolean {
  const auth = loadSessionAuth();
  return auth?.sessionId === sessionId && Boolean(auth.token);
}

export function loadActiveLocation(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LOCATION_KEY);
}

export function saveActiveLocation(code: string) {
  localStorage.setItem(LOCATION_KEY, code);
}

export function clearActiveLocation() {
  localStorage.removeItem(LOCATION_KEY);
}
