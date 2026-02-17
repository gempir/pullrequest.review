import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HostAuthForm } from "@/components/auth/host-auth-form";
import { PullRequestReviewPage } from "@/components/pull-request-review-page";
import { usePrContext } from "@/lib/pr-context";

export const Route = createFileRoute("/$workspace/$repo/pull/$pullRequestId")({
    component: GithubPullRequestRoute,
});

function GithubPullRequestRoute() {
    const { workspace, repo, pullRequestId } = Route.useParams();
    const { authByHost } = usePrContext();
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
                    <HostAuthForm
                        host="github"
                        mode="inline"
                        onSuccess={() => {
                            setAuthPromptVisible(false);
                            setRenderKey((prev) => prev + 1);
                        }}
                    />
                ) : null
            }
        />
    );
}
