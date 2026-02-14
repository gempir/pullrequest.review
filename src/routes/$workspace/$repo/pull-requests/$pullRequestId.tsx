import { createFileRoute } from "@tanstack/react-router";
import { PullRequestReviewPage } from "@/components/pull-request-review-page";
import { usePrContext } from "@/lib/pr-context";

export const Route = createFileRoute("/$workspace/$repo/pull-requests/$pullRequestId")({
    component: BitbucketPullRequestRoute,
});

function BitbucketPullRequestRoute() {
    const { workspace, repo, pullRequestId } = Route.useParams();
    const { authByHost } = usePrContext();

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
        />
    );
}
