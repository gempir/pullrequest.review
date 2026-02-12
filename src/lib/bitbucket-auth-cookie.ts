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
  if (typeof window === "undefined") return null;
  return parseStoredCredentials(
    window.localStorage.getItem(BITBUCKET_AUTH_KEY),
  );
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
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    BITBUCKET_AUTH_KEY,
    JSON.stringify({ email, apiToken } satisfies BitbucketSessionCookie),
  );
}

export function hasBitbucketSession() {
  const session = readStoredCredentials();
  return Boolean(session?.email && session?.apiToken);
}

export function clearBitbucketSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BITBUCKET_AUTH_KEY);
}
