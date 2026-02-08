import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { exchangeOAuthCode } from "@/lib/bitbucket-oauth";
import { usePrContext } from "@/lib/pr-context";

export const Route = createFileRoute("/oauth/callback")({
  component: OAuthCallback,
});

function OAuthCallback() {
  const navigate = useNavigate();
  const { setAuth } = usePrContext();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const storedState = window.localStorage.getItem("bitbucket_oauth_state");
    window.localStorage.removeItem("bitbucket_oauth_state");

    if (!code || !state || !storedState || state !== storedState) {
      setMessage("OAuth state mismatch. Please try again.");
      return;
    }

    const redirectUri = `${window.location.origin}/oauth/callback`;
    exchangeOAuthCode({ data: { code, redirectUri } })
      .then((result) => {
        setAuth({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
        });
        navigate({ to: "/" });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "OAuth failed";
        setMessage(msg);
      });
  }, [navigate, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm text-sm">
        {message}
      </div>
    </div>
  );
}
