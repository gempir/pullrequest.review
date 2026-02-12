import {
  clearBitbucketSession,
  hasBitbucketSession,
  setBitbucketCredentials,
} from "@/lib/bitbucket-auth-cookie";

function encodeBasicAuth(email: string, apiToken: string) {
  const bytes = new TextEncoder().encode(`${email}:${apiToken}`);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function loginWithApiCredentials(data: {
  email: string;
  apiToken: string;
}) {
  const email = data.email.trim();
  const token = data.apiToken.trim();
  if (!email) {
    throw new Error("Email is required");
  }
  if (!token) {
    throw new Error("API token is required");
  }

  const res = await fetch("https://api.bitbucket.org/2.0/user", {
    headers: {
      Authorization: `Basic ${encodeBasicAuth(email, token)}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    let details = "";

    if (contentType.includes("application/json")) {
      try {
        const payload = (await res.json()) as {
          error?: { message?: string; detail?: string };
        };
        details =
          payload.error?.detail?.trim() ||
          payload.error?.message?.trim() ||
          "";
      } catch {
        details = "";
      }
    } else {
      try {
        details = (await res.text()).trim();
      } catch {
        details = "";
      }
    }

    const status = `${res.status} ${res.statusText}`;
    throw new Error(
      details
        ? `Bitbucket authentication failed (${status}): ${details}`
        : `Bitbucket authentication failed (${status})`,
    );
  }

  setBitbucketCredentials(email, token);
  return { authenticated: true };
}

export async function getSessionAuth() {
  return { authenticated: hasBitbucketSession() };
}

export async function logoutSession() {
  clearBitbucketSession();
  return { authenticated: false };
}
