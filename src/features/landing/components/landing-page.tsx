import { LandingMainContent } from "@/features/landing/components/landing-main-content";
import { useLandingPageView } from "@/features/landing/hooks/use-landing-page-view";
import type { GitHost } from "@/lib/git-host/types";

export function LandingPage({
    initialHost,
    initialDiffPanel = "pull-requests",
}: {
    initialHost?: GitHost;
    initialDiffPanel?: "pull-requests" | "repositories";
} = {}) {
    const view = useLandingPageView({ initialHost, initialDiffPanel });

    return (
        <div className="h-full min-h-0 flex bg-background">
            <LandingMainContent
                showRepositoryPanel={view.showRepositoryPanel}
                isRefreshing={view.isRefreshing}
                activeHost={view.activeHost}
                authByHost={view.authByHost}
                reposByHost={view.reposByHost}
                selectedRepoCount={view.selectedRepoCount}
                isRepoPullRequestLoading={view.isRepoPullRequestLoading}
                repoPullRequestError={view.repoPullRequestError}
                sortedRootPullRequests={view.sortedRootPullRequests}
                onHome={view.onHome}
                onRefresh={view.refreshCurrentView}
                onToggleSettings={view.onToggleSettings}
                onSaveSelectedRepos={view.onSaveSelectedRepos}
                onClearRepos={view.clearReposForHost}
                onDisconnectHost={view.onDisconnectHost}
                onOpenRepositorySelection={view.openRepositorySelection}
                onOpenPullRequest={view.openPullRequest}
            />
        </div>
    );
}
