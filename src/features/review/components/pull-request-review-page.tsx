import { PullRequestReviewPage as PullRequestReviewPageInner } from "@/components/pull-request-review/review-page";
import { ReviewPerformanceProviders } from "@/components/pull-request-review/review-performance-providers";

export function PullRequestReviewPage(props: Parameters<typeof PullRequestReviewPageInner>[0]) {
    return (
        <ReviewPerformanceProviders>
            <PullRequestReviewPageInner {...props} />
        </ReviewPerformanceProviders>
    );
}
