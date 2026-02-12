import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

const BITBUCKET_AUTH_COOKIE = "bitbucket_auth";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

interface BitbucketSessionCookie {
  email: string;
  apiToken: string;
}

function parseAuthCookie(rawCookie: string | undefined): BitbucketSessionCookie | null {
  if (!rawCookie) return null;
  try {
    const parsed = JSON.parse(rawCookie) as Partial<BitbucketSessionCookie>;
    const email = parsed.email?.trim();
    const apiToken = parsed.apiToken?.trim();
    if (!email || !apiToken) return null;
    return { email, apiToken };
  } catch {
    return null;
  }
}

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

function encodeBasicAuth(email: string, apiToken: string) {
  return Buffer.from(`${email}:${apiToken}`).toString("base64");
}

export function requireBitbucketBasicAuthHeader() {
  const session = parseAuthCookie(getCookie(BITBUCKET_AUTH_COOKIE));
  if (!session) {
    throw new Error("Not authenticated");
  }
  return `Basic ${encodeBasicAuth(session.email, session.apiToken)}`;
}

export function setBitbucketCredentials(email: string, apiToken: string) {
  setCookie(
    BITBUCKET_AUTH_COOKIE,
    JSON.stringify({ email, apiToken } satisfies BitbucketSessionCookie),
    authCookieOptions(),
  );
}

export function hasBitbucketSession() {
  const session = parseAuthCookie(getCookie(BITBUCKET_AUTH_COOKIE));
  return Boolean(session?.email && session?.apiToken);
}

export function clearBitbucketSession() {
  deleteCookie(BITBUCKET_AUTH_COOKIE, { path: "/" });
}
