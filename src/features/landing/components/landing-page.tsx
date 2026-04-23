import { LandingMainContent } from "@/features/landing/components/landing-main-content";
import { LandingSidebar } from "@/features/landing/components/landing-sidebar";
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
            <LandingSidebar
                activeFile={view.activeFile}
                showSettingsPanel={view.showSettingsPanel}
                searchQuery={view.searchQuery}
                pullRequestTreeEntries={view.pullRequestTree.entries}
                onSearchQueryChange={view.setSearchQuery}
                onHome={view.onHome}
                onRefresh={view.refreshCurrentView}
                onToggleSettings={view.onToggleSettings}
                onFileClick={view.handleSidebarFileClick}
            />
            <LandingMainContent
                showSettingsPanel={view.showSettingsPanel}
                showRepositoryPanel={view.showRepositoryPanel}
                activeHost={view.activeHost}
                activeFile={view.activeFile}
                authByHost={view.authByHost}
                reposByHost={view.reposByHost}
                selectedRepoCount={view.selectedRepoCount}
                isRepoPullRequestLoading={view.isRepoPullRequestLoading}
                repoPullRequestError={view.repoPullRequestError}
                sortedRootPullRequests={view.sortedRootPullRequests}
                onSetActiveFile={view.setActiveFile}
                onSettingsClose={view.onSettingsClose}
                onSaveSelectedRepos={view.onSaveSelectedRepos}
                onClearRepos={view.clearReposForHost}
                onDisconnectHost={view.onDisconnectHost}
                onOpenRepositorySelection={view.openRepositorySelection}
                onOpenPullRequest={view.openPullRequest}
            />
        </div>
    );
}
