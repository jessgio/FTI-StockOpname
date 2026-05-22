import { loadSessionAuth } from "./session-store";

export async function apiFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const auth = loadSessionAuth();
  const headers = new Headers(init.headers);
  if (auth?.token) {
    headers.set("X-Session-Token", auth.token);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}
