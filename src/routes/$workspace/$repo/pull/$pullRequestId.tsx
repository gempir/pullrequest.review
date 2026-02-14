import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { PullRequestReviewPage } from "@/components/pull-request-review-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePrContext } from "@/lib/pr-context";

export const Route = createFileRoute("/$workspace/$repo/pull/$pullRequestId")({
    component: GithubPullRequestRoute,
});

function GithubPullRequestRoute() {
    const { workspace, repo, pullRequestId } = Route.useParams();
    const { authByHost, login } = usePrContext();
    const [githubToken, setGithubToken] = useState("");
    const [authPromptError, setAuthPromptError] = useState<string | null>(null);
    const [authPromptSubmitting, setAuthPromptSubmitting] = useState(false);
    const [authPromptVisible, setAuthPromptVisible] = useState(false);
    const [renderKey, setRenderKey] = useState(0);

    return (
        <PullRequestReviewPage
            key={renderKey}
            host="github"
            workspace={workspace}
            repo={repo}
            pullRequestId={pullRequestId}
            auth={{ canRead: true, canWrite: authByHost.github }}
            onRequireAuth={() => setAuthPromptVisible(true)}
            authPromptSlot={
                authPromptVisible ? (
                    <form
                        className="space-y-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!githubToken.trim()) return;
                            setAuthPromptError(null);
                            setAuthPromptSubmitting(true);
                            login({ host: "github", token: githubToken })
                                .then(() => {
                                    setGithubToken("");
                                    setAuthPromptVisible(false);
                                    setRenderKey((prev) => prev + 1);
                                })
                                .catch((error) => {
                                    setAuthPromptError(error instanceof Error ? error.message : "Failed to authenticate GitHub");
                                })
                                .finally(() => {
                                    setAuthPromptSubmitting(false);
                                });
                        }}
                    >
                        <p className="text-[13px] text-muted-foreground">Use a GitHub fine-grained personal access token to continue.</p>
                        <Button
                            type="button"
                            className="w-full"
                            variant="outline"
                            onClick={() => window.open("https://github.com/settings/personal-access-tokens/new", "_blank", "noopener,noreferrer")}
                        >
                            <ExternalLink className="size-3.5" />
                            Create GitHub Fine-Grained Token
                        </Button>
                        <Input
                            type="password"
                            value={githubToken}
                            onChange={(event) => setGithubToken(event.target.value)}
                            placeholder="GitHub fine-grained personal access token"
                            disabled={authPromptSubmitting}
                        />
                        <Button type="submit" className="w-full" disabled={authPromptSubmitting || !githubToken.trim()}>
                            {authPromptSubmitting ? "Authenticating..." : "Authenticate"}
                        </Button>
                        {authPromptError ? <p className="text-[12px] text-destructive">[AUTH ERROR] {authPromptError}</p> : null}
                        <p className="text-[12px] text-muted-foreground">Credentials are stored in the local app database.</p>
                    </form>
                ) : null
            }
        />
    );
}
