import { type PullRequestReviewPageProps, useReviewPageController } from "@/features/review/hooks/use-review-page-controller";

export type { PullRequestReviewPageProps } from "@/features/review/hooks/use-review-page-controller";

export function PullRequestReviewPage(props: PullRequestReviewPageProps) {
    return useReviewPageController(props);
}
