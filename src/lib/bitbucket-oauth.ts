import { createServerFn } from "@tanstack/react-start";

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

function encodeBasicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}) {
  const url = new URL("https://bitbucket.org/site/oauth2/authorize");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  if (params.scope) {
    url.searchParams.set("scope", params.scope);
  }
  return url.toString();
}

export const exchangeOAuthCode = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data: { code: string; redirectUri: string } }) => {
  const clientId = process.env.VITE_BITBUCKET_CLIENT_ID ?? "";
  const clientSecret = process.env.BITBUCKET_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("Missing VITE_BITBUCKET_CLIENT_ID or BITBUCKET_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: data.code,
    redirect_uri: data.redirectUri,
  });

  const res = await fetch("https://bitbucket.org/site/oauth2/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodeBasicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`OAuth token exchange failed: ${res.status} ${res.statusText}`);
  }

  const payload = (await res.json()) as OAuthTokenResponse;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : undefined,
  } as OAuthTokenResult;
});

export const refreshOAuthToken = createServerFn({
  method: "POST",
}).handler(async ({ data }: { data: { refreshToken: string } }) => {
  const clientId = process.env.VITE_BITBUCKET_CLIENT_ID ?? "";
  const clientSecret = process.env.BITBUCKET_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("Missing VITE_BITBUCKET_CLIENT_ID or BITBUCKET_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: data.refreshToken,
  });

  const res = await fetch("https://bitbucket.org/site/oauth2/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodeBasicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`OAuth refresh failed: ${res.status} ${res.statusText}`);
  }

  const payload = (await res.json()) as OAuthTokenResponse;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : undefined,
  } as OAuthTokenResult;
});
