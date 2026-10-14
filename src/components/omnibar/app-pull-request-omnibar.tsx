import { useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { subscribeAppPullRequestOmnibarOpen } from "@/components/omnibar/app-omnibar-events";
import { PullRequestOmnibar } from "@/components/omnibar/pull-request-omnibar";
import { useSelectedRepoPullRequests } from "@/features/landing/hooks/use-selected-repo-pull-requests";
import { useKeyboardNavigation } from "@/lib/shortcuts-context";

function isReviewPath(pathname: string) {
    return /^\/[^/]+\/[^/]+\/pull(?:-requests)?\/[^/]+/.test(pathname);
}

export function AppPullRequestOmnibar() {
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });
    const onReviewPage = isReviewPath(pathname);
    const [open, setOpen] = useState(false);
    const { sortedRootPullRequests, openPullRequest } = useSelectedRepoPullRequests({ autoRefetch: !onReviewPage });

    const handleOpenOmnibar = useCallback(() => {
        if (onReviewPage) return;
        setOpen(true);
    }, [onReviewPage]);

    useEffect(() => subscribeAppPullRequestOmnibarOpen(handleOpenOmnibar), [handleOpenOmnibar]);

    useKeyboardNavigation({
        onOpenOmnibar: handleOpenOmnibar,
    });

    if (onReviewPage) return null;

    return <PullRequestOmnibar open={open} onOpenChange={setOpen} pullRequests={sortedRootPullRequests} onSelectPullRequest={openPullRequest} />;
}
