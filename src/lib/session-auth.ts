import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getSecret(): string {
  const secret =
    process.env.SESSION_AUTH_SECRET?.trim() ||
    process.env.GOOGLE_SPREADSHEET_ID?.trim();
  if (!secret) {
    throw new Error("SESSION_AUTH_SECRET or GOOGLE_SPREADSHEET_ID must be set");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function issueSessionToken(sessionId: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${sessionId}:${exp}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function verifySessionToken(
  token: string | null | undefined,
  sessionId: string,
): boolean {
  if (!token?.trim()) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;
    const [id, expStr, signature] = parts;
    if (id !== sessionId) return false;
    const exp = Number(expStr);
    if (!exp || Date.now() > exp) return false;
    const payload = `${id}:${expStr}`;
    const expected = sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function getSessionTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("x-session-token");
  if (header?.trim()) return header.trim();
  return null;
}
