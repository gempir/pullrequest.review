import {
  readStorageValue,
  removeStorageValue,
  writeStorageValue,
} from "@/lib/storage/versioned-local-storage";

const BITBUCKET_AUTH_KEY = "bitbucket_auth";

interface BitbucketSessionCookie {
  email: string;
  apiToken: string;
}

function parseStoredCredentials(
  rawValue: string | null,
): BitbucketSessionCookie | null {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue) as Partial<BitbucketSessionCookie>;
    const email = parsed.email?.trim();
    const apiToken = parsed.apiToken?.trim();
    if (!email || !apiToken) return null;
    return { email, apiToken };
  } catch {
    return null;
  }
}

function readStoredCredentials() {
  return parseStoredCredentials(readStorageValue(BITBUCKET_AUTH_KEY));
}

function encodeBasicAuth(email: string, apiToken: string) {
  const raw = `${email}:${apiToken}`;
  const bytes = new TextEncoder().encode(raw);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function requireBitbucketBasicAuthHeader() {
  const session = readStoredCredentials();
  if (!session) {
    throw new Error("Not authenticated");
  }
  return `Basic ${encodeBasicAuth(session.email, session.apiToken)}`;
}

export function setBitbucketCredentials(email: string, apiToken: string) {
  writeStorageValue(
    BITBUCKET_AUTH_KEY,
    JSON.stringify({ email, apiToken } satisfies BitbucketSessionCookie),
  );
}

export function hasBitbucketSession() {
  const session = readStoredCredentials();
  return Boolean(session?.email && session?.apiToken);
}

export function clearBitbucketSession() {
  removeStorageValue(BITBUCKET_AUTH_KEY);
}
