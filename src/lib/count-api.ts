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
  const shouldSetJsonContentType =
    init.body &&
    !headers.has("Content-Type") &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof URLSearchParams);
  if (shouldSetJsonContentType) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}
