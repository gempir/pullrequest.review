import { AlertCircle, GitPullRequest, House, Loader2, RefreshCw, Settings2 } from "lucide-react";
import { HostAuthForm } from "@/components/auth/host-auth-form";
import { GitHostIcon } from "@/components/git-host-icon";
import { requestOpenAppPullRequestOmnibar } from "@/components/omnibar/app-pull-request-omnibar";
import { OmnibarMenubarInput } from "@/components/omnibar/omnibar-menubar-input";
import { RepositorySelector } from "@/components/repository-selector";
import { Button } from "@/components/ui/button";
import { LandingPullRequestTable } from "@/features/landing/components/landing-pull-request-table";
import type { SortedRootPullRequest } from "@/features/landing/model/landing-model";
import { getHostLabel } from "@/lib/git-host/service";
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
}) {
    return (
        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <header data-component="navbar" className="flex h-11 items-center gap-1 border-b border-border-muted bg-chrome px-2 text-[12px]">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                    onClick={onHome}
                    aria-label="Home"
                >
                    <House className="size-3.5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                    onClick={onToggleSettings}
                    aria-label="Settings"
                >
                    <Settings2 className="size-3.5" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                        void onRefresh();
                    }}
                    aria-label="Refresh current view data"
                >
                    <RefreshCw className={cn("size-3.5", isRefreshing ? "animate-spin" : undefined)} />
                </Button>
                {showRepositoryPanel ? <span className="ml-2 shrink-0 text-muted-foreground">Repository Selection</span> : null}
                <OmnibarMenubarInput onOpen={requestOpenAppPullRequestOmnibar} />
                <div className="flex shrink-0 items-center gap-1 pl-2">
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
                                    "h-8 gap-1.5 rounded-sm px-2 text-[11px] text-muted-foreground hover:text-foreground",
                                    isActive ? "bg-selection text-foreground" : null,
                                )}
                                onClick={() => onOpenRepositorySelection(host)}
                                aria-label={`${getHostLabel(host)} settings`}
                                title={`${getHostLabel(host)} repositories${repoCount > 0 ? ` (${repoCount})` : ""}`}
                            >
                                <GitHostIcon host={host} className="size-3.5" />
                                <span>{getHostLabel(host)}</span>
                                {repoCount > 0 ? <span className="font-mono text-muted-foreground">{repoCount}</span> : null}
                            </Button>
                        );
                    })}
                </div>
            </header>

            <main data-component="diff-view" className={cn("min-h-0 flex-1", showRepositoryPanel ? "overflow-y-auto p-4" : "overflow-hidden p-4")}>
                {showRepositoryPanel ? (
                    <div className="max-w-3xl space-y-4">
                        {authByHost[activeHost] ? (
                            <>
                                <RepositorySelector
                                    host={activeHost}
                                    initialSelected={reposByHost[activeHost]}
                                    saveLabel="Save Selection"
                                    onSave={(nextRepos) => onSaveSelectedRepos(activeHost, nextRepos)}
                                />
                                <div className="flex justify-end">
                                    <Button variant="outline" className="rounded-md" onClick={() => onClearRepos(activeHost)}>
                                        Clear {getHostLabel(activeHost)} repositories
                                    </Button>
                                </div>
                                <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                                    <div className="text-[12px] text-muted-foreground">Danger zone</div>
                                    <Button
                                        variant="outline"
                                        className="rounded-md border-destructive/30 text-destructive hover:bg-destructive/10"
                                        onClick={() => {
                                            if (!window.confirm(`Disconnect ${getHostLabel(activeHost)} and clear its repositories?`)) return;
                                            onDisconnectHost(activeHost);
                                        }}
                                    >
                                        Disconnect {getHostLabel(activeHost)}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <HostAuthPanel host={activeHost} />
                        )}
                    </div>
                ) : selectedRepoCount === 0 ? (
                    <div className="max-w-2xl space-y-2 rounded-md border border-border-muted bg-surface-1 p-8 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <GitPullRequest className="size-4" />
                            <span className="text-[13px]">No repositories selected.</span>
                        </div>
                        <p className="text-[12px] text-muted-foreground">Use Bitbucket or GitHub in the top right to choose repositories.</p>
                    </div>
                ) : isRepoPullRequestLoading ? (
                    <div className="max-w-2xl rounded-md border border-border-muted bg-surface-1 p-4">
                        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            <span>Loading pull requests...</span>
                        </div>
                    </div>
                ) : repoPullRequestError ? (
                    <div className="max-w-2xl rounded-md border border-destructive/40 bg-destructive/10 p-4 text-[13px] text-destructive">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="size-4" />
                            <span>[ERROR] {repoPullRequestError instanceof Error ? repoPullRequestError.message : "Failed to load pull requests"}</span>
                        </div>
                    </div>
                ) : sortedRootPullRequests.length === 0 ? (
                    <div className="max-w-2xl space-y-2 rounded-md border border-border-muted bg-surface-1 p-8 text-center">
                        <p className="text-[13px] text-muted-foreground">No pull requests in selected repositories.</p>
                        <p className="text-[12px] text-muted-foreground">Use Bitbucket or GitHub in the top right to manage repositories.</p>
                    </div>
                ) : (
                    <div className="flex h-full min-h-0 flex-col">
                        <LandingPullRequestTable data={sortedRootPullRequests} onOpenPullRequest={onOpenPullRequest} />
                    </div>
                )}
            </main>
        </section>
    );
}
