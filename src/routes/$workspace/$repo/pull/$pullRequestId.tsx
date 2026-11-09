import { createFileRoute } from "@tanstack/react-router";
import { PullRequestRoute } from "@/features/review/components/pull-request-route";
import { validateReviewDiffScopeSearch } from "@/features/review/model/review-diff-scope";

export const Route = createFileRoute("/$workspace/$repo/pull/$pullRequestId")({
    validateSearch: validateReviewDiffScopeSearch,
    component: GithubPullRequestRoute,
});

function GithubPullRequestRoute() {
    const navigate = Route.useNavigate();
    return (
        <PullRequestRoute
            host="github"
            params={Route.useParams()}
            search={Route.useSearch()}
            onSearchChange={(next) => {
                navigate({ search: () => next, replace: true });
            }}
        />
    );
}
