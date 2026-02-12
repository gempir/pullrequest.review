import { createServerFn } from "@tanstack/react-start";

function encodeBasicAuth(email: string, apiToken: string) {
  return Buffer.from(`${email}:${apiToken}`).toString("base64");
}

export const loginWithApiCredentials = createServerFn({
  method: "POST",
})
  .inputValidator((data: { email: string; apiToken: string }) => data)
  .handler(async ({ data }) => {
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

    const { setBitbucketCredentials } = await import("./bitbucket-auth-cookie");
    setBitbucketCredentials(email, token);

    return { authenticated: true };
  });

export const getSessionAuth = createServerFn({
  method: "GET",
}).handler(async () => {
  const { hasBitbucketSession } = await import("./bitbucket-auth-cookie");
  return { authenticated: hasBitbucketSession() };
});

export const logoutSession = createServerFn({
  method: "POST",
}).handler(async () => {
  const { clearBitbucketSession } = await import("./bitbucket-auth-cookie");
  clearBitbucketSession();
  return { authenticated: false };
});
