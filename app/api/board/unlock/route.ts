import { NextRequest, NextResponse } from "next/server";
import {
  BOARD_ACCESS_COOKIE,
  boardAccessCookieOptions,
  createBoardAccessToken,
  verifyBoardAccessSecret,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const secret = String(body.secret ?? "");

    if (!secret.trim()) {
      return NextResponse.json(
        { error: "Access secret is required" },
        { status: 400 }
      );
    }

    if (!verifyBoardAccessSecret(secret)) {
      return NextResponse.json(
        { error: "Invalid access secret" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      BOARD_ACCESS_COOKIE,
      createBoardAccessToken(),
      boardAccessCookieOptions()
    );
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to unlock board";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { verifyBoardAccessToken } = await import("@/lib/auth");
  const token = request.cookies.get(BOARD_ACCESS_COOKIE)?.value;
  return NextResponse.json({
    unlocked: verifyBoardAccessToken(token),
  });
}
