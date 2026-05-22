import { NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  verifySessionToken,
} from "./session-auth";

export function requireSessionToken(
  request: Request,
  sessionId: string,
): NextResponse | null {
  const token = getSessionTokenFromRequest(request);
  if (!verifySessionToken(token, sessionId)) {
    return NextResponse.json(
      { error: "Session PIN required or expired. Go back and unlock the session." },
      { status: 401 },
    );
  }
  return null;
}
