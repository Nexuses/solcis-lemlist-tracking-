import { NextRequest, NextResponse } from "next/server";
import {
  BOARD_ACCESS_COOKIE,
  SESSION_COOKIE,
  verifyBoardAccessToken,
  verifySessionToken,
} from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage =
    pathname === "/login" || pathname === "/signup";
  const isAdminPage = pathname === "/";
  const isAdminApi =
    pathname.startsWith("/api/automations") ||
    pathname.startsWith("/api/campaigns");
  const isBoardPage = pathname.startsWith("/board/");
  const isBoardApi =
    pathname.startsWith("/api/board/") &&
    !pathname.startsWith("/api/board/unlock");

  const session = verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value
  );
  const boardUnlocked = verifyBoardAccessToken(
    request.cookies.get(BOARD_ACCESS_COOKIE)?.value
  );

  if (isAdminPage && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isAdminApi && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if ((isBoardPage || isBoardApi) && !boardUnlocked) {
    if (isBoardApi) {
      return NextResponse.json(
        { error: "Board access required", code: "BOARD_LOCKED" },
        { status: 401 }
      );
    }

    // Allow board page through so unlock UI can render; API stays locked.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/board/:path*",
    "/api/automations/:path*",
    "/api/campaigns",
    "/api/board/:path*",
  ],
};
