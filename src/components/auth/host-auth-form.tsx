import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHostLabel } from "@/lib/git-host/service";
import type { GitHost } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";

type HostAuthFormMode = "onboarding" | "panel" | "inline";

export function HostAuthForm({ host, mode = "panel", onSuccess }: { host: GitHost; mode?: HostAuthFormMode; onSuccess?: () => void }) {
    const { login } = usePrContext();
    const [email, setEmail] = useState("");
    const [apiToken, setApiToken] = useState("");
    const [githubToken, setGithubToken] = useState("");
    const [copiedScopes, setCopiedScopes] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isBitbucket = host === "bitbucket";
    const bitbucketScopeText = ["read:repository:bitbucket", "read:user:bitbucket", "read:pullrequest:bitbucket", "write:pullrequest:bitbucket"].join(", ");
    const ctaLabel = mode === "inline" ? "Authenticate" : `Connect ${getHostLabel(host)}`;

    return (
        <form
            className="space-y-3"
            onSubmit={(event) => {
                event.preventDefault();
                setError(null);
                setIsSubmitting(true);

                const promise = isBitbucket ? login({ host: "bitbucket", email, apiToken }) : login({ host: "github", token: githubToken });

                promise
                    .then(() => {
                        setEmail("");
                        setApiToken("");
                        setGithubToken("");
                        onSuccess?.();
                    })
                    .catch((err) => {
                        setError(err instanceof Error ? err.message : "Failed to authenticate");
                    })
                    .finally(() => {
                        setIsSubmitting(false);
                    });
            }}
        >
            <p className="text-[13px] text-muted-foreground">
                {isBitbucket ? "Use your Bitbucket email and API token to continue." : "Use a GitHub fine-grained personal access token to continue."}
            </p>

            {isBitbucket ? (
                <div className={`border border-border bg-card p-3 ${mode === "onboarding" ? "text-[13px]" : "text-[12px]"} space-y-2`}>
                    <div className="text-muted-foreground">Required scopes</div>
                    <div className={mode === "onboarding" ? "leading-relaxed break-words" : "break-words"}>{bitbucketScopeText}</div>
                    {mode === "onboarding" ? (
                        <div className="border border-status-modified/50 bg-status-modified/15 text-status-modified px-2 py-1.5 text-[12px]">
                            Hint: Paste these scopes into "Search by scope name" while creating the token
                        </div>
                    ) : null}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => {
                            void navigator.clipboard.writeText(bitbucketScopeText);
                            setCopiedScopes(true);
                            window.setTimeout(() => setCopiedScopes(false), 1200);
                        }}
                    >
                        {copiedScopes ? "Copied" : "Copy scopes"}
                    </Button>
                </div>
            ) : null}

            <Button
                type="button"
                variant={mode === "onboarding" ? "default" : "outline"}
                className="w-full"
                onClick={() =>
                    window.open(
                        isBitbucket ? "https://id.atlassian.com/manage-profile/security/api-tokens" : "https://github.com/settings/personal-access-tokens/new",
                        "_blank",
                        "noopener,noreferrer",
                    )
                }
            >
                <ExternalLink className="size-3.5" />
                {isBitbucket ? "Create Atlassian Bitbucket Scoped API Token" : "Create GitHub Fine-Grained Token"}
            </Button>

            {isBitbucket ? (
                <>
                    <Input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={mode === "onboarding" ? "Bitbucket account email" : "Bitbucket email"}
                        autoComplete="email"
                        className={mode === "onboarding" ? "text-[14px] h-10" : undefined}
                        disabled={isSubmitting}
                    />
                    <Input
                        type="password"
                        value={apiToken}
                        onChange={(event) => setApiToken(event.target.value)}
                        placeholder={mode === "onboarding" ? "Bitbucket API token" : "Bitbucket API token"}
                        autoComplete="current-password"
                        className={mode === "onboarding" ? "text-[14px] h-10" : undefined}
                        disabled={isSubmitting}
                    />
                </>
            ) : (
                <Input
                    type="password"
                    value={githubToken}
                    onChange={(event) => setGithubToken(event.target.value)}
                    placeholder={mode === "onboarding" ? "GitHub fine-grained personal access token" : "GitHub fine-grained PAT"}
                    autoComplete="current-password"
                    className={mode === "onboarding" ? "text-[14px] h-10" : undefined}
                    disabled={isSubmitting}
                />
            )}

            <Button
                type="submit"
                className={mode === "onboarding" ? "w-full text-[14px] h-10" : "w-full"}
                disabled={isSubmitting || (isBitbucket ? !email.trim() || !apiToken.trim() : !githubToken.trim())}
            >
                {isSubmitting ? "Authenticating..." : ctaLabel}
            </Button>

            {error ? <div className="border border-destructive bg-destructive/10 p-3 text-destructive text-[13px]">[AUTH ERROR] {error}</div> : null}
            <p className="text-[12px] text-muted-foreground">Credentials are stored in the local app database.</p>
        </form>
    );
}
