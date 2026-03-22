import { useLiveQuery } from "@tanstack/react-db";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSettingsTreeItems } from "@/components/settings-navigation";
import {
    buildGroupedPullRequests,
    buildPullRequestsByRepo,
    buildPullRequestTree,
    buildSortedRootPullRequests,
    DEFAULT_REVIEW_SCOPE_SEARCH,
    type DiffPanel,
    HOST_PATH_PREFIX,
    HOSTS,
    hostFromLandingTreePath,
} from "@/features/landing/model/landing-model";
import { type FileNode, useFileTree } from "@/lib/file-tree-context";
import { getRepoPullRequestCollection, getRepositoryCollection } from "@/lib/git-host/query-collections";
import type { GitHost, RepoRef } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";

export function useLandingPageView({ initialHost, initialDiffPanel = "pull-requests" }: { initialHost?: GitHost; initialDiffPanel?: DiffPanel } = {}) {
    const navigate = useNavigate();
    const { setTree, setKinds, activeFile, setActiveFile } = useFileTree();
    const { authByHost, activeHost, setActiveHost, reposByHost, setReposForHost, clearReposForHost, logout } = usePrContext();

    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [diffPanel, setDiffPanel] = useState<DiffPanel>(initialDiffPanel);
    const [autoRefetchRepoPrScopeKey, setAutoRefetchRepoPrScopeKey] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const showRepositoryPanel = diffPanel === "repositories";
    const showPullRequestPanel = diffPanel === "pull-requests";
    const settingsTreeItems = useMemo(() => getSettingsTreeItems(), []);
    const settingsPathSet = useMemo(() => new Set(settingsTreeItems.map((item) => item.path)), [settingsTreeItems]);

    useEffect(() => {
        if (!initialHost) return;
        setActiveHost(initialHost);
        setDiffPanel("repositories");
    }, [initialHost, setActiveHost]);

    const hostsWithSelectedRepos = useMemo(() => HOSTS.filter((host) => reposByHost[host].length > 0), [reposByHost]);
    const repoPullRequestScopeKey = useMemo(
        () =>
            HOSTS.map(
                (host) =>
                    `${host}:${reposByHost[host]
                        .map((repo) => repo.fullName)
                        .sort()
                        .join(",")}`,
            )
                .join("|")
                .trim(),
        [reposByHost],
    );

    const repoPullRequestCollection = useMemo(
        () =>
            getRepoPullRequestCollection({
                hosts: hostsWithSelectedRepos,
                reposByHost,
            }),
        [hostsWithSelectedRepos, reposByHost],
    );
    const activeHostRepositoryCollection = useMemo(() => getRepositoryCollection(activeHost), [activeHost]);
    const repoPullRequestsQuery = useLiveQuery(
        (q) => q.from({ repoPullRequest: repoPullRequestCollection.collection }).select(({ repoPullRequest }) => ({ ...repoPullRequest })),
        [repoPullRequestCollection],
    );

    useEffect(() => {
        if (showSettingsPanel || !showPullRequestPanel) return;
        if (hostsWithSelectedRepos.length === 0 || repoPullRequestCollection.utils.isFetching || repoPullRequestCollection.utils.lastError) return;
        if (autoRefetchRepoPrScopeKey === repoPullRequestScopeKey) return;
        setAutoRefetchRepoPrScopeKey(repoPullRequestScopeKey);
        void repoPullRequestCollection.utils.refetch({ throwOnError: false });
    }, [autoRefetchRepoPrScopeKey, hostsWithSelectedRepos.length, repoPullRequestCollection, repoPullRequestScopeKey, showPullRequestPanel, showSettingsPanel]);

    const groupedPullRequests = useMemo(
        () => buildGroupedPullRequests(repoPullRequestsQuery.data ?? [], reposByHost),
        [repoPullRequestsQuery.data, reposByHost],
    );
    const pullRequestsByRepo = useMemo(() => buildPullRequestsByRepo(groupedPullRequests), [groupedPullRequests]);
    const sortedRootPullRequests = useMemo(() => buildSortedRootPullRequests(groupedPullRequests), [groupedPullRequests]);
    const pullRequestTree = useMemo(() => buildPullRequestTree(reposByHost, pullRequestsByRepo, searchQuery), [pullRequestsByRepo, reposByHost, searchQuery]);

    const syncTreeFromPanel = useCallback(() => {
        if (showSettingsPanel) {
            const settingsNodes: FileNode[] = settingsTreeItems.map((item) => ({
                name: item.name,
                path: item.path,
                type: "file",
            }));
            setTree(settingsNodes);
            setKinds(new Map());
            return;
        }
        setTree(pullRequestTree.root);
        setKinds(new Map());
        if (!activeFile || (!activeFile.startsWith(HOST_PATH_PREFIX) && !pullRequestTree.pullRequestMeta.has(activeFile))) {
            setActiveFile(undefined);
        }
    }, [activeFile, pullRequestTree, setActiveFile, setKinds, setTree, settingsTreeItems, showSettingsPanel]);

    useEffect(() => {
        syncTreeFromPanel();
    }, [syncTreeFromPanel]);

    useEffect(() => {
        if (!showSettingsPanel) return;
        const firstSettingsPath = settingsTreeItems[0]?.path;
        if (!firstSettingsPath) return;
        if (!activeFile || !settingsPathSet.has(activeFile)) {
            setActiveFile(firstSettingsPath);
        }
    }, [activeFile, setActiveFile, settingsPathSet, settingsTreeItems, showSettingsPanel]);

    useEffect(() => {
        if (showSettingsPanel || diffPanel !== "repositories") return;
        const hostPath = `${HOST_PATH_PREFIX}${activeHost}`;
        if (activeFile === hostPath) return;
        setActiveFile(hostPath);
    }, [activeFile, activeHost, diffPanel, setActiveFile, showSettingsPanel]);

    const refreshCurrentView = useCallback(async () => {
        if (showSettingsPanel) return;
        if (showRepositoryPanel) {
            await activeHostRepositoryCollection.utils.refetch({ throwOnError: false });
            return;
        }
        if (!showPullRequestPanel) return;
        await repoPullRequestCollection.utils.refetch({ throwOnError: false });
    }, [activeHostRepositoryCollection, repoPullRequestCollection, showPullRequestPanel, showRepositoryPanel, showSettingsPanel]);

    const openRepositorySelection = useCallback(
        (host: GitHost) => {
            navigate({
                to: "/$host",
                params: { host },
            });
        },
        [navigate],
    );

    const openPullRequest = useCallback(
        (repo: RepoRef, pullRequestId: string) => {
            if (repo.host === "github") {
                navigate({
                    to: "/$workspace/$repo/pull/$pullRequestId",
                    params: {
                        workspace: repo.workspace,
                        repo: repo.repo,
                        pullRequestId,
                    },
                    search: DEFAULT_REVIEW_SCOPE_SEARCH,
                    hash: "",
                });
                return;
            }
            navigate({
                to: "/$workspace/$repo/pull-requests/$pullRequestId",
                params: {
                    workspace: repo.workspace,
                    repo: repo.repo,
                    pullRequestId,
                },
                search: DEFAULT_REVIEW_SCOPE_SEARCH,
                hash: "",
            });
        },
        [navigate],
    );

    const handleSidebarFileClick = useCallback(
        (path: string) => {
            if (showSettingsPanel && settingsPathSet.has(path)) {
                setActiveFile(path);
                return;
            }
            if (path.startsWith(HOST_PATH_PREFIX)) {
                const host = path.slice(HOST_PATH_PREFIX.length);
                if (host === "bitbucket" || host === "github") {
                    setShowSettingsPanel(false);
                    setActiveHost(host);
                    setDiffPanel("repositories");
                    openRepositorySelection(host);
                }
                return;
            }
            const meta = pullRequestTree.pullRequestMeta.get(path);
            if (!meta) return;
            setActiveHost(meta.host);
            openPullRequest(
                {
                    host: meta.host,
                    workspace: meta.workspace,
                    repo: meta.repo,
                    fullName: `${meta.workspace}/${meta.repo}`,
                    displayName: meta.repo,
                },
                meta.pullRequestId,
            );
        },
        [openPullRequest, openRepositorySelection, pullRequestTree.pullRequestMeta, setActiveFile, setActiveHost, settingsPathSet, showSettingsPanel],
    );

    const handleSidebarDirectoryClick = useCallback(
        (path: string) => {
            const host = hostFromLandingTreePath(path);
            if (!host) return undefined;
            setShowSettingsPanel(false);
            setActiveHost(host);
            setDiffPanel("repositories");
            openRepositorySelection(host);
            return true;
        },
        [openRepositorySelection, setActiveHost],
    );

    return {
        activeFile,
        activeHost,
        authByHost,
        pullRequestTree,
        reposByHost,
        repoPullRequestError: repoPullRequestCollection.utils.lastError,
        searchQuery,
        selectedRepoCount: reposByHost.bitbucket.length + reposByHost.github.length,
        settingsPathSet,
        showRepositoryPanel,
        showSettingsPanel,
        sortedRootPullRequests,
        isRepoPullRequestLoading:
            hostsWithSelectedRepos.length > 0 &&
            (repoPullRequestsQuery.isLoading || (repoPullRequestCollection.utils.isFetching && (repoPullRequestsQuery.data?.length ?? 0) === 0)),
        clearReposForHost,
        logout,
        openPullRequest,
        openRepositorySelection,
        refreshCurrentView,
        setActiveFile,
        setDiffPanel,
        setReposForHost,
        setSearchQuery,
        setShowSettingsPanel,
        handleSidebarDirectoryClick,
        handleSidebarFileClick,
        onSettingsClose: () => {
            setShowSettingsPanel(false);
            setDiffPanel("pull-requests");
            setActiveFile(undefined);
        },
        onHome: () => {
            setShowSettingsPanel(false);
            setSearchQuery("");
            setDiffPanel("pull-requests");
            setActiveFile(undefined);
            navigate({ to: "/" });
        },
        onToggleSettings: () => {
            setShowSettingsPanel((prev) => !prev);
        },
        onSaveSelectedRepos: (host: GitHost, repos: RepoRef[]) => {
            setReposForHost(host, repos);
            navigate({ to: "/" });
        },
        onDisconnectHost: (host: GitHost) => {
            void logout(host);
        },
    };
}
