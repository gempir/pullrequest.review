import { createContext, useContext } from "react";
import type { ReviewController } from "@/features/review/hooks/use-review-controller";
import type { PullRequestBundle } from "@/lib/git-host/types";

type LoadedReview = ReviewController & { prData: PullRequestBundle };

export const ReviewContext = createContext<LoadedReview | null>(null);

export function useReview() {
    const review = useContext(ReviewContext);
    if (!review) throw new Error("useReview must be used within ReviewContext");
    return review;
}
