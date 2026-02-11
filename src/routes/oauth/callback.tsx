import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { exchangeOAuthCode } from "@/lib/bitbucket-oauth";
import { usePrContext } from "@/lib/pr-context";
import { Loader2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/oauth/callback")({
  component: OAuthCallback,
});

function OAuthCallback() {
  const navigate = useNavigate();
  const { setAuth } = usePrContext();
  const [message, setMessage] = useState("Authenticating...");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const storedState = window.localStorage.getItem("bitbucket_oauth_state");
    window.localStorage.removeItem("bitbucket_oauth_state");

    if (!code || !state || !storedState || state !== storedState) {
      setMessage("OAuth state mismatch. Please try again.");
      setIsError(true);
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
        setIsError(true);
      });
  }, [navigate, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 bg-secondary">
          <span className="text-[13px] font-medium">OAuth Callback</span>
        </div>
        <div className="p-6">
          <div
            className={`flex items-center gap-3 text-[13px] ${isError ? "text-destructive" : "text-muted-foreground"}`}
          >
            {isError ? (
              <AlertCircle className="size-5" />
            ) : (
              <Loader2 className="size-5 animate-spin" />
            )}
            <span>{isError ? `[ERROR] ${message}` : message}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
