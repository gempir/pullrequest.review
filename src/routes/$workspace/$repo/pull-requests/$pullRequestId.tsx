import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { PullRequestReviewPage } from "@/components/pull-request-review-page";
import { usePrContext } from "@/lib/pr-context";
import { type ReviewDiffScopeSearch, validateReviewDiffScopeSearch } from "@/lib/review-diff-scope";
import { markReviewPerf } from "@/lib/review-performance/metrics";

export const Route = createFileRoute("/$workspace/$repo/pull-requests/$pullRequestId")({
    validateSearch: validateReviewDiffScopeSearch,
    component: BitbucketPullRequestRoute,
});

function BitbucketPullRequestRoute() {
    const { workspace, repo, pullRequestId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const { authByHost } = usePrContext();

    useEffect(() => {
        markReviewPerf("route_enter");
    }, []);

    return (
        <PullRequestReviewPage
            host="bitbucket"
            workspace={workspace}
            repo={repo}
            pullRequestId={pullRequestId}
            auth={{
                canRead: authByHost.bitbucket,
                canWrite: authByHost.bitbucket,
            }}
            reviewDiffScopeSearch={search}
            onReviewDiffScopeSearchChange={(next: ReviewDiffScopeSearch) => {
                navigate({
                    search: () => next,
                    replace: true,
                });
            }}
        />
    );
}
