import { createFileRoute } from "@tanstack/react-router";
import { PullRequestRoute } from "@/features/review/components/pull-request-route";
import { validateReviewDiffScopeSearch } from "@/lib/review-diff-scope";

export const Route = createFileRoute("/$workspace/$repo/pull-requests/$pullRequestId")({
    validateSearch: validateReviewDiffScopeSearch,
    component: BitbucketPullRequestRoute,
});

function BitbucketPullRequestRoute() {
    const navigate = Route.useNavigate();
    return (
        <PullRequestRoute
            host="bitbucket"
            params={Route.useParams()}
            search={Route.useSearch()}
            onSearchChange={(next) => {
                navigate({ search: () => next, replace: true });
            }}
        />
    );
}
