import { NextResponse } from "next/server";
import {
  getSessionFromCookies,
  getSessionFromRequest,
  hasBoardAccessFromCookies,
  hasBoardAccessFromRequest,
  type SessionPayload,
} from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function requireAuth(): Promise<
  { session: SessionPayload } | { error: NextResponse }
> {
  const session = await getSessionFromCookies();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session };
}

export function requireAuthFromRequest(
  request: NextRequest
): { session: SessionPayload } | { error: NextResponse } {
  const session = getSessionFromRequest(request);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session };
}

export async function requireBoardAccess(): Promise<
  { ok: true } | { error: NextResponse }
> {
  const ok = await hasBoardAccessFromCookies();
  if (!ok) {
    return {
      error: NextResponse.json(
        { error: "Board access required", code: "BOARD_LOCKED" },
        { status: 401 }
      ),
    };
  }
  return { ok: true };
}

export function requireBoardAccessFromRequest(
  request: NextRequest
): { ok: true } | { error: NextResponse } {
  if (!hasBoardAccessFromRequest(request)) {
    return {
      error: NextResponse.json(
        { error: "Board access required", code: "BOARD_LOCKED" },
        { status: 401 }
      ),
    };
  }
  return { ok: true };
}
