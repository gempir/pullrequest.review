import { House, RefreshCw, Settings2 } from "lucide-react";
import { HostAuthForm } from "@/components/auth/host-auth-form";
import { GitHostIcon } from "@/components/git-host-icon";
import { requestOpenAppPullRequestOmnibar } from "@/components/omnibar/app-omnibar-events";
import { OmnibarMenubarInput } from "@/components/omnibar/omnibar-menubar-input";
import { RepositorySelector } from "@/components/repository-selector";
import { Button } from "@/components/ui/button";
import { InboxView } from "@/features/landing/components/inbox-view";
import type { PullRequestTarget, SortedRootPullRequest } from "@/features/landing/model/landing-model";
import { getHostLabel } from "@/lib/git-host/registry";
import type { GitHost, RepoRef } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";
import { cn } from "@/lib/utils";

const HOST_MENU_ORDER: GitHost[] = ["bitbucket", "github"];

function HostAuthPanel({ host }: { host: GitHost }) {
    const { authByHost, logout } = usePrContext();
    const authenticated = authByHost[host];

    if (authenticated) {
        return (
            <div className="space-y-3">
                <div className="text-[13px] text-muted-foreground">{getHostLabel(host)} is connected.</div>
                <Button
                    variant="outline"
                    onClick={() => {
                        if (!window.confirm(`Disconnect ${getHostLabel(host)}?`)) return;
                        void logout(host);
                    }}
                >
                    Disconnect {getHostLabel(host)}
                </Button>
            </div>
        );
    }

    return <HostAuthForm host={host} mode="panel" />;
}

function LandingRepositoryPanel({
    activeHost,
    authenticated,
    selectedRepos,
    onSaveSelectedRepos,
    onClearRepos,
    onDisconnectHost,
}: {
    activeHost: GitHost;
    authenticated: boolean;
    selectedRepos: RepoRef[];
    onSaveSelectedRepos: (host: GitHost, repos: RepoRef[]) => void;
    onClearRepos: (host: GitHost) => void;
    onDisconnectHost: (host: GitHost) => void;
}) {
    if (!authenticated) return <HostAuthPanel host={activeHost} />;
    return (
        <>
            <RepositorySelector
                host={activeHost}
                initialSelected={selectedRepos}
                saveLabel="Save Selection"
                onSave={(nextRepos) => onSaveSelectedRepos(activeHost, nextRepos)}
            />
            <div className="flex justify-end">
                <Button variant="ghost" className="rounded-full" onClick={() => onClearRepos(activeHost)}>
                    Clear {getHostLabel(activeHost)} repositories
                </Button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border-muted pt-4">
                <span className="text-[13px] text-muted-foreground">Remove this account and its repositories from this browser.</span>
                <Button
                    variant="ghost"
                    className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                        if (!window.confirm(`Disconnect ${getHostLabel(activeHost)} and clear its repositories?`)) return;
                        onDisconnectHost(activeHost);
                    }}
                >
                    Disconnect {getHostLabel(activeHost)}
                </Button>
            </div>
        </>
    );
}

export function LandingMainContent({
    showRepositoryPanel,
    isRefreshing,
    activeHost,
    authByHost,
    reposByHost,
    selectedRepoCount,
    isRepoPullRequestLoading,
    repoPullRequestError,
    sortedRootPullRequests,
    onHome,
    onRefresh,
    onToggleSettings,
    onSaveSelectedRepos,
    onClearRepos,
    onDisconnectHost,
    onOpenRepositorySelection,
    onOpenPullRequest,
    onOpenTarget,
}: {
    showRepositoryPanel: boolean;
    isRefreshing: boolean;
    activeHost: GitHost;
    authByHost: Record<GitHost, boolean>;
    reposByHost: Record<GitHost, RepoRef[]>;
    selectedRepoCount: number;
    isRepoPullRequestLoading: boolean;
    repoPullRequestError: unknown;
    sortedRootPullRequests: SortedRootPullRequest[];
    onHome: () => void;
    onRefresh: () => Promise<void> | void;
    onToggleSettings: () => void;
    onSaveSelectedRepos: (host: GitHost, repos: RepoRef[]) => void;
    onClearRepos: (host: GitHost) => void;
    onDisconnectHost: (host: GitHost) => void;
    onOpenRepositorySelection: (host: GitHost) => void;
    onOpenPullRequest: (repo: RepoRef, pullRequestId: string) => void;
    onOpenTarget: (target: PullRequestTarget) => void;
}) {
    const firstConnectedHost = HOST_MENU_ORDER.find((host) => authByHost[host]) ?? activeHost;
    const iconButton = "size-8 shrink-0 rounded-full p-0 text-muted-foreground hover:text-foreground";
    return (
        <section className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
            <main data-component="diff-view" className="canvas-page absolute inset-0 overflow-y-auto">
                {showRepositoryPanel ? (
                    <div className="mx-auto max-w-[760px] space-y-4 px-3">
                        <h1 className="display-title flex items-center gap-2.5 text-[26px]">
                            <GitHostIcon host={activeHost} className="size-6" />
                            {getHostLabel(activeHost)}
                        </h1>
                        <LandingRepositoryPanel
                            activeHost={activeHost}
                            authenticated={authByHost[activeHost]}
                            selectedRepos={reposByHost[activeHost]}
                            onSaveSelectedRepos={onSaveSelectedRepos}
                            onClearRepos={onClearRepos}
                            onDisconnectHost={onDisconnectHost}
                        />
                    </div>
                ) : (
                    <InboxView
                        rows={sortedRootPullRequests}
                        selectedRepoCount={selectedRepoCount}
                        isLoading={isRepoPullRequestLoading}
                        error={repoPullRequestError}
                        onOpenPullRequest={onOpenPullRequest}
                        onOpenTarget={onOpenTarget}
                        onChooseRepositories={() => onOpenRepositorySelection(firstConnectedHost)}
                    />
                )}
            </main>
            <div className="scroll-edge-top" aria-hidden="true" />

            <div className="pointer-events-none absolute inset-x-0 top-[var(--panel-inset)] z-30 flex justify-center px-4">
                <header
                    data-component="navbar"
                    className="glass pointer-events-auto flex h-11 w-full max-w-[860px] items-center gap-0.5 rounded-full px-1.5 text-[12px]"
                >
                    <Button type="button" variant="ghost" size="sm" className={iconButton} onClick={onHome} aria-label="Home">
                        <House className="size-3.5" />
                    </Button>
                    <span className="section-title px-1.5 text-[14px]">{showRepositoryPanel ? "Repositories" : "Inbox"}</span>
                    <OmnibarMenubarInput onOpen={requestOpenAppPullRequestOmnibar} />
                    {HOST_MENU_ORDER.map((host) => {
                        const isActive = showRepositoryPanel && activeHost === host;
                        const repoCount = reposByHost[host].length;
                        return (
                            <Button
                                key={host}
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "h-8 gap-1.5 rounded-full px-2.5 text-[12px] text-muted-foreground hover:text-foreground",
                                    isActive ? "bg-selection text-accent hover:text-accent" : null,
                                )}
                                onClick={() => onOpenRepositorySelection(host)}
                                aria-label={`${getHostLabel(host)} settings`}
                                title={`${getHostLabel(host)} repositories${repoCount > 0 ? ` (${repoCount})` : ""}`}
                            >
                                <GitHostIcon host={host} className="size-3.5" />
                                {repoCount > 0 ? <span className="tabular-nums">{repoCount}</span> : null}
                            </Button>
                        );
                    })}
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={iconButton}
                        onClick={() => {
                            void onRefresh();
                        }}
                        aria-label="Refresh current view data"
                    >
                        <RefreshCw className={cn("size-3.5", isRefreshing ? "animate-spin" : undefined)} />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className={iconButton} onClick={onToggleSettings} aria-label="Settings">
                        <Settings2 className="size-3.5" />
                    </Button>
                </header>
            </div>
        </section>
    );
}
