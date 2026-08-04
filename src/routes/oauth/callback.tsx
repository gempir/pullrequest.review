import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { exchangeBitbucketOAuthCode } from "@/lib/bitbucket-oauth";
import { usePrContext } from "@/lib/pr-context";

export const Route = createFileRoute("/oauth/callback")({
    component: OAuthCallback,
});

function OAuthCallback() {
    const { login } = usePrContext();
    const startedRef = useRef(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;

        const searchParams = new URL(window.location.href).searchParams;
        const providerError = searchParams.get("error_description") ?? searchParams.get("error");
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        if (providerError) {
            setError(providerError);
            return;
        }
        if (!code || !state) {
            setError("Bitbucket did not return a valid authorization response. Please try again.");
            return;
        }

        void exchangeBitbucketOAuthCode({ code, state })
            .then(async (result) => {
                await login({
                    host: "bitbucket",
                    method: "oauth",
                    accessToken: result.accessToken,
                    refreshToken: result.refreshToken,
                    expiresAt: result.expiresAt,
                });
                window.location.replace(result.returnTo);
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Bitbucket OAuth authentication failed");
            });
    }, [login]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <div className="w-full max-w-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-3 bg-surface-1">
                    <span className="text-[13px] font-medium">Bitbucket OAuth</span>
                </div>
                <div className="space-y-4 p-6">
                    <div className={error ? "text-[13px] text-destructive" : "text-[13px] text-muted-foreground"}>
                        {error ? `[AUTH ERROR] ${error}` : "Completing sign-in..."}
                    </div>
                    {error ? (
                        <Link
                            to="/"
                            className="inline-flex h-8 items-center border border-border bg-transparent px-4 text-[13px] text-foreground transition-colors hover:bg-surface-hover"
                        >
                            Return to sign in
                        </Link>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
