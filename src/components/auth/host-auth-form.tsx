import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getHostLabel } from "@/lib/git-host/service";
import type { GitHost } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";

type HostAuthFormMode = "onboarding" | "panel" | "inline";

function useHostAuthFormState({ host, onSuccess }: { host: GitHost; onSuccess?: () => void }) {
    const { login } = usePrContext();
    const [email, setEmail] = useState("");
    const [apiToken, setApiToken] = useState("");
    const [githubToken, setGithubToken] = useState("");
    const [copiedScopes, setCopiedScopes] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isBitbucket = host === "bitbucket";
    const bitbucketScopeText = ["read:repository:bitbucket", "read:user:bitbucket", "read:pullrequest:bitbucket", "write:pullrequest:bitbucket"].join(", ");
    const authenticate = async () => {
        setError(null);
        setIsSubmitting(true);

        const promise = isBitbucket ? login({ host: "bitbucket", email, apiToken }) : login({ host: "github", token: githubToken });

        await promise
            .then(() => {
                setEmail("");
                setApiToken("");
                setGithubToken("");
                onSuccess?.();
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Failed to authenticate");
            });
        setIsSubmitting(false);
    };

    return {
        isBitbucket,
        email,
        apiToken,
        githubToken,
        copiedScopes,
        isSubmitting,
        error,
        bitbucketScopeText,
        setEmail,
        setApiToken,
        setGithubToken,
        setCopiedScopes,
        authenticate,
    };
}

export function HostAuthForm({ host, mode = "panel", onSuccess }: { host: GitHost; mode?: HostAuthFormMode; onSuccess?: () => void }) {
    const {
        isBitbucket,
        email,
        apiToken,
        githubToken,
        copiedScopes,
        isSubmitting,
        error,
        bitbucketScopeText,
        setEmail,
        setApiToken,
        setGithubToken,
        setCopiedScopes,
        authenticate,
    } = useHostAuthFormState({ host, onSuccess });
    const ctaLabel = mode === "inline" ? "Authenticate" : `Connect ${getHostLabel(host)}`;
    const isOnboarding = mode === "onboarding";
    const fieldClassName = isOnboarding ? "h-10 rounded-md bg-background text-[13px]" : "rounded-md";

    return (
        <form className="space-y-4" action={authenticate}>
            <div className="rounded-md border border-border-muted bg-surface-1 p-4">
                <div className="space-y-1">
                    <p className="text-[13px] text-muted-foreground">
                        {isBitbucket ? "Use your Bitbucket email and API token to continue." : "Use a GitHub fine-grained personal access token to continue."}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                        {isBitbucket ? "Authentication stays local to this app." : "Create a token, paste it below, and continue."}
                    </p>
                </div>

                <div className="mt-4 space-y-3">
                    <Button
                        type="button"
                        variant={isOnboarding ? "default" : "outline"}
                        className="h-9 w-full rounded-md justify-center"
                        onClick={() =>
                            window.open(
                                isBitbucket
                                    ? "https://id.atlassian.com/manage-profile/security/api-tokens"
                                    : "https://github.com/settings/personal-access-tokens/new",
                                "_blank",
                                "noopener,noreferrer",
                            )
                        }
                    >
                        <ExternalLink className="size-3.5" />
                        {isBitbucket ? "Create Atlassian Bitbucket Scoped API Token" : "Create GitHub Fine-Grained Token"}
                    </Button>

                    {isBitbucket ? (
                        <div className="rounded-md border border-border-muted bg-background p-3 text-[12px]">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-muted-foreground">Required scopes</div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-md"
                                    onClick={() => {
                                        void navigator.clipboard.writeText(bitbucketScopeText);
                                        setCopiedScopes(true);
                                        window.setTimeout(() => setCopiedScopes(false), 1200);
                                    }}
                                >
                                    {copiedScopes ? "Copied" : "Copy scopes"}
                                </Button>
                            </div>
                            <div className="mt-2 break-words font-mono text-[11px] leading-relaxed text-foreground">{bitbucketScopeText}</div>
                            {isOnboarding ? (
                                <div className="mt-3 rounded-md border border-status-modified/20 bg-status-modified/10 px-3 py-2 text-[11px] text-status-modified">
                                    Paste these scopes into "Search by scope name" while creating the token.
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {isBitbucket ? (
                        <div className="grid gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[12px] text-muted-foreground">Bitbucket Email</Label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="name@example.com"
                                    autoComplete="email"
                                    className={fieldClassName}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[12px] text-muted-foreground">Scoped API Token</Label>
                                <Input
                                    type="password"
                                    value={apiToken}
                                    onChange={(event) => setApiToken(event.target.value)}
                                    placeholder="Paste your Bitbucket API token"
                                    autoComplete="current-password"
                                    className={fieldClassName}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            <Label className="text-[12px] text-muted-foreground">GitHub Token</Label>
                            <Input
                                type="password"
                                value={githubToken}
                                onChange={(event) => setGithubToken(event.target.value)}
                                placeholder="Paste your GitHub fine-grained token"
                                autoComplete="current-password"
                                className={fieldClassName}
                                disabled={isSubmitting}
                            />
                        </div>
                    )}
                </div>
            </div>

            <Button
                type="submit"
                className={isOnboarding ? "h-10 w-full rounded-md text-[13px]" : "w-full rounded-md"}
                disabled={isSubmitting || (isBitbucket ? !email.trim() || !apiToken.trim() : !githubToken.trim())}
            >
                {isSubmitting ? "Authenticating..." : ctaLabel}
            </Button>

            {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive text-[13px]">[AUTH ERROR] {error}</div>
            ) : null}
            <p className="text-[12px] text-muted-foreground">Credentials are stored in the local app database.</p>
        </form>
    );
}
