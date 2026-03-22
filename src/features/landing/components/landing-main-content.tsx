import { AlertCircle, GitPullRequest, Loader2 } from "lucide-react";
import { HostAuthForm } from "@/components/auth/host-auth-form";
import { GitHostIcon } from "@/components/git-host-icon";
import { RepositorySelector } from "@/components/repository-selector";
import { SettingsPanelContentOnly } from "@/components/settings-menu";
import { settingsPathForTab, settingsTabFromPath } from "@/components/settings-navigation";
import { Timestamp } from "@/components/timestamp";
import { Button } from "@/components/ui/button";
import type { SortedRootPullRequest } from "@/features/landing/model/landing-model";
import { getHostLabel } from "@/lib/git-host/service";
import type { GitHost, PullRequestSummary, RepoRef } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";
import { cn } from "@/lib/utils";

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

function PullRequestListItem({
    host,
    repo,
    pullRequest,
    showRepoLabel,
    onOpenPullRequest,
}: {
    host: GitHost;
    repo: RepoRef;
    pullRequest: PullRequestSummary;
    showRepoLabel: boolean;
    onOpenPullRequest: (repo: RepoRef, pullRequestId: string) => void;
}) {
    return (
        <div className="space-y-1">
            {showRepoLabel ? (
                <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <span className="inline-flex items-center justify-center text-foreground">
                        <GitHostIcon host={host} className="size-3.5" />
                    </span>
                    <span className="font-mono">{repo.fullName}</span>
                </div>
            ) : null}
            <button
                type="button"
                className="w-full rounded-md border border-transparent bg-surface-1 px-3 py-2 text-left text-[13px] transition-colors hover:border-border-muted hover:bg-surface-2"
                onClick={() => onOpenPullRequest(repo, String(pullRequest.id))}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="truncate font-medium text-foreground">{pullRequest.title}</div>
                    {pullRequest.updatedAt ? (
                        <span className="shrink-0 text-muted-foreground">
                            Updated <Timestamp value={pullRequest.updatedAt} />
                        </span>
                    ) : null}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                    #{pullRequest.id} - {pullRequest.author?.displayName ?? "Unknown author"}
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                    <span>
                        {pullRequest.source?.branch?.name ?? "source"} -&gt; {pullRequest.destination?.branch?.name ?? "target"}
                    </span>
                    {pullRequest.createdAt ? (
                        <span className="shrink-0">
                            Created <Timestamp value={pullRequest.createdAt} />
                        </span>
                    ) : null}
                </div>
            </button>
        </div>
    );
}

export function LandingMainContent({
    showSettingsPanel,
    showRepositoryPanel,
    activeHost,
    activeFile,
    authByHost,
    reposByHost,
    selectedRepoCount,
    isRepoPullRequestLoading,
    repoPullRequestError,
    sortedRootPullRequests,
    onSetActiveFile,
    onSettingsClose,
    onSaveSelectedRepos,
    onClearRepos,
    onDisconnectHost,
    onOpenRepositorySelection,
    onOpenPullRequest,
}: {
    showSettingsPanel: boolean;
    showRepositoryPanel: boolean;
    activeHost: GitHost;
    activeFile: string | undefined;
    authByHost: Record<GitHost, boolean>;
    reposByHost: Record<GitHost, RepoRef[]>;
    selectedRepoCount: number;
    isRepoPullRequestLoading: boolean;
    repoPullRequestError: unknown;
    sortedRootPullRequests: SortedRootPullRequest[];
    onSetActiveFile: (path: string | undefined) => void;
    onSettingsClose: () => void;
    onSaveSelectedRepos: (host: GitHost, repos: RepoRef[]) => void;
    onClearRepos: (host: GitHost) => void;
    onDisconnectHost: (host: GitHost) => void;
    onOpenRepositorySelection: (host: GitHost) => void;
    onOpenPullRequest: (repo: RepoRef, pullRequestId: string) => void;
}) {
    return (
        <section className="flex-1 min-w-0 min-h-0 flex flex-col">
            <header data-component="navbar" className="h-11 bg-chrome border-b border-border-muted px-3 flex items-center gap-2 text-[12px]">
                <span className="text-muted-foreground">
                    {showSettingsPanel ? "Settings" : showRepositoryPanel ? "Repository Selection" : "Open Pull Requests"}
                </span>
                <span className="ml-auto text-muted-foreground">{selectedRepoCount} selected repos</span>
            </header>

            <main data-component="diff-view" className={cn("flex-1 min-h-0 overflow-y-auto", showSettingsPanel ? "p-0" : "p-4")}>
                {showSettingsPanel ? (
                    <div className="h-full min-h-0">
                        <SettingsPanelContentOnly
                            activeTab={settingsTabFromPath(activeFile) ?? "appearance"}
                            onActiveTabChange={(tab) => {
                                onSetActiveFile(settingsPathForTab(tab));
                            }}
                            onClose={onSettingsClose}
                        />
                    </div>
                ) : showRepositoryPanel ? (
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
                                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-3">
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
                    <div className="rounded-md border border-border-muted bg-surface-1 p-8 text-center space-y-3 max-w-2xl">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <GitPullRequest className="size-4" />
                            <span className="text-[13px]">No repositories selected.</span>
                        </div>
                        <Button
                            variant="outline"
                            className="h-8 rounded-sm border-border-muted bg-background font-mono text-[12px] tracking-wide hover:bg-surface-2"
                            onClick={() => onOpenRepositorySelection(activeHost)}
                        >
                            Select Repositories
                        </Button>
                    </div>
                ) : isRepoPullRequestLoading ? (
                    <div className="rounded-md border border-border-muted bg-surface-1 p-4 max-w-2xl">
                        <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
                            <Loader2 className="size-4 animate-spin" />
                            <span>Loading pull requests...</span>
                        </div>
                    </div>
                ) : repoPullRequestError ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive text-[13px] max-w-2xl">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="size-4" />
                            <span>[ERROR] {repoPullRequestError instanceof Error ? repoPullRequestError.message : "Failed to load pull requests"}</span>
                        </div>
                    </div>
                ) : sortedRootPullRequests.length === 0 ? (
                    <div className="rounded-md border border-border-muted bg-surface-1 p-8 text-center space-y-3 max-w-2xl">
                        <p className="text-[13px] text-muted-foreground">No pull requests in selected repositories.</p>
                        <Button
                            variant="outline"
                            className="h-8 rounded-sm border-border-muted bg-background font-mono text-[12px] tracking-wide hover:bg-surface-2"
                            onClick={() => onOpenRepositorySelection(activeHost)}
                        >
                            Manage Repositories
                        </Button>
                    </div>
                ) : (
                    <div className="max-w-4xl">
                        <div className="space-y-2">
                            {sortedRootPullRequests.map(({ host, repo, repoKey, pullRequest, updatedDateLabel }, index) => {
                                const previous = sortedRootPullRequests[index - 1];
                                const showRepoLabel =
                                    !previous || previous.repoKey !== repoKey || !updatedDateLabel || previous.updatedDateLabel !== updatedDateLabel;

                                return (
                                    <PullRequestListItem
                                        key={`${host}:${repo.fullName}-${pullRequest.id}`}
                                        host={host}
                                        repo={repo}
                                        pullRequest={pullRequest}
                                        showRepoLabel={showRepoLabel}
                                        onOpenPullRequest={onOpenPullRequest}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </section>
    );
}
