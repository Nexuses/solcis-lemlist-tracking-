import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { ObjectId } from "mongodb";

export const SESSION_COOKIE = "lt_session";
export const BOARD_ACCESS_COOKIE = "lt_board_access";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days
const BOARD_ACCESS_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export interface User {
  _id?: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  exp: number;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_SECRET environment variable");
  }
  return secret;
}

function getBoardAccessSecret(): string {
  const secret = process.env.BOARD_ACCESS_SECRET;
  if (!secret) {
    throw new Error("Missing BOARD_ACCESS_SECRET environment variable");
  }
  return secret;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function encodePayload(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload<T>(encoded: string): T | null {
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== next.length) return false;
  return timingSafeEqual(expected, next);
}

export function createSessionToken(user: {
  _id: ObjectId | string;
  email: string;
  name: string;
}): string {
  const payload: SessionPayload = {
    userId: String(user._id),
    email: user.email,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  };
  const body = encodePayload(payload);
  const signature = sign(body, getAuthSecret());
  return `${body}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body, getAuthSecret());
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const payload = decodePayload<SessionPayload>(body);
  if (!payload?.userId || !payload.exp) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function createBoardAccessToken(): string {
  const secret = getBoardAccessSecret();
  const body = encodePayload({
    ok: true,
    exp: Math.floor(Date.now() / 1000) + BOARD_ACCESS_MAX_AGE_SEC,
  });
  return `${body}.${sign(body, secret)}`;
}

export function verifyBoardAccessToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;

  let secret: string;
  try {
    secret = getBoardAccessSecret();
  } catch {
    return false;
  }

  const expected = sign(body, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const payload = decodePayload<{ ok?: boolean; exp?: number }>(body);
  if (!payload?.ok || !payload.exp) return false;
  return payload.exp >= Math.floor(Date.now() / 1000);
}

export function verifyBoardAccessSecret(input: string): boolean {
  const expected = getBoardAccessSecret();
  const a = Buffer.from(input.trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function boardAccessCookieOptions(maxAge = BOARD_ACCESS_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export function getSessionFromRequest(request: NextRequest): SessionPayload | null {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export function hasBoardAccessFromRequest(request: NextRequest): boolean {
  return verifyBoardAccessToken(request.cookies.get(BOARD_ACCESS_COOKIE)?.value);
}

export async function hasBoardAccessFromCookies(): Promise<boolean> {
  const jar = await cookies();
  return verifyBoardAccessToken(jar.get(BOARD_ACCESS_COOKIE)?.value);
}
