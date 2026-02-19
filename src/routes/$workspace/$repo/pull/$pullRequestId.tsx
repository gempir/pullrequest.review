import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HostAuthForm } from "@/components/auth/host-auth-form";
import { PullRequestReviewPage } from "@/components/pull-request-review-page";
import { usePrContext } from "@/lib/pr-context";
import { type ReviewDiffScopeSearch, validateReviewDiffScopeSearch } from "@/lib/review-diff-scope";
import { markReviewPerf } from "@/lib/review-performance/metrics";

export const Route = createFileRoute("/$workspace/$repo/pull/$pullRequestId")({
    validateSearch: validateReviewDiffScopeSearch,
    component: GithubPullRequestRoute,
});

function GithubPullRequestRoute() {
    const { workspace, repo, pullRequestId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const { authByHost } = usePrContext();
    const [authPromptVisible, setAuthPromptVisible] = useState(false);
    const [renderKey, setRenderKey] = useState(0);

    useEffect(() => {
        markReviewPerf("route_enter");
    }, []);

    return (
        <PullRequestReviewPage
            key={renderKey}
            host="github"
            workspace={workspace}
            repo={repo}
            pullRequestId={pullRequestId}
            auth={{ canRead: true, canWrite: authByHost.github }}
            onRequireAuth={() => setAuthPromptVisible(true)}
            reviewDiffScopeSearch={search}
            onReviewDiffScopeSearchChange={(next: ReviewDiffScopeSearch) => {
                navigate({
                    search: () => next,
                    replace: true,
                });
            }}
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
