import { useEffect } from "react";

export function useReviewDocumentTitle({ isLoading, pullRequestTitle }: { isLoading: boolean; pullRequestTitle?: string }) {
    useEffect(() => {
        if (typeof document === "undefined") return;
        if (isLoading) {
            document.title = "pullrequest.review";
            return;
        }
        const nextTitle = pullRequestTitle?.trim();
        document.title = nextTitle && nextTitle.length > 0 ? nextTitle : "pullrequest.review";
        return () => {
            document.title = "pullrequest.review";
        };
    }, [isLoading, pullRequestTitle]);
}
