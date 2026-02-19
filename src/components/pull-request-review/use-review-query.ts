import { useLiveQuery } from "@tanstack/react-db";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
    getGitHostFetchActivitySnapshot,
    getHostDataCollectionsVersionSnapshot,
    getPullRequestBundleCollection,
    type PullRequestBundleRecord,
    pullRequestDetailsFetchScopeId,
    subscribeGitHostFetchActivity,
    subscribeHostDataCollectionsVersion,
} from "@/lib/git-host/query-collections";
import { parseSchema, pullRequestBundleSchema } from "@/lib/git-host/schemas";
import { getCapabilitiesForHost } from "@/lib/git-host/service";
import { type GitHost, HostApiError } from "@/lib/git-host/types";

interface UseReviewQueryProps {
    host: GitHost;
    workspace: string;
    repo: string;
    pullRequestId: string;
    canRead: boolean;
    canWrite: boolean;
    onRequireAuth?: (reason: "rate_limit") => void;
}

export function isRateLimitedError(error: unknown) {
    if (!error) return false;
    if (error instanceof HostApiError) {
        return error.status === 429 || error.status === 403;
    }
    if (error instanceof Error) {
        return error.message.includes("429") || error.message.includes("403");
    }
    return false;
}

function normalizeBundleRecord(value: unknown): PullRequestBundleRecord | undefined {
    const parsed = parseSchema(pullRequestBundleSchema, value);
    if (!parsed) return undefined;
    return {
        ...(value as PullRequestBundleRecord),
        diffstat: Array.isArray(parsed.diffstat) ? (parsed.diffstat as PullRequestBundleRecord["diffstat"]) : [],
        commits: Array.isArray(parsed.commits) ? (parsed.commits as PullRequestBundleRecord["commits"]) : [],
        comments: Array.isArray(parsed.comments) ? (parsed.comments as PullRequestBundleRecord["comments"]) : [],
        history: Array.isArray(parsed.history) ? (parsed.history as PullRequestBundleRecord["history"]) : [],
        reviewers: Array.isArray(parsed.reviewers) ? (parsed.reviewers as PullRequestBundleRecord["reviewers"]) : [],
        buildStatuses: Array.isArray(parsed.buildStatuses) ? (parsed.buildStatuses as PullRequestBundleRecord["buildStatuses"]) : [],
    };
}

export function useReviewQuery({ host, workspace, repo, pullRequestId, canRead, canWrite, onRequireAuth }: UseReviewQueryProps) {
    const hostCapabilities = useMemo(() => getCapabilitiesForHost(host), [host]);
    const canLoadPullRequest = canRead || hostCapabilities.publicReadSupported;
    const bundleId = useMemo(() => `${host}:${workspace}/${repo}/${pullRequestId}`, [host, pullRequestId, repo, workspace]);
    const fetchScopeId = useMemo(() => pullRequestDetailsFetchScopeId({ host, workspace, repo, pullRequestId }), [host, workspace, repo, pullRequestId]);
    const fetchActivity = useSyncExternalStore(subscribeGitHostFetchActivity, getGitHostFetchActivitySnapshot, getGitHostFetchActivitySnapshot);
    const hostDataCollectionsVersion = useSyncExternalStore(
        subscribeHostDataCollectionsVersion,
        getHostDataCollectionsVersionSnapshot,
        getHostDataCollectionsVersionSnapshot,
    );

    const bundleStore = useMemo(() => {
        // Depend on host-data collection version so we rescope when persistence falls back.
        void hostDataCollectionsVersion;
        if (!canLoadPullRequest) return null;
        return getPullRequestBundleCollection({
            host,
            workspace,
            repo,
            pullRequestId,
        });
    }, [canLoadPullRequest, host, hostDataCollectionsVersion, pullRequestId, repo, workspace]);

    const bundleQuery = useLiveQuery(
        (q) => {
            if (!bundleStore) return undefined;
            return q.from({ bundle: bundleStore.collection }).select(({ bundle }) => ({ ...bundle }));
        },
        [bundleStore],
    );

    const queryData = useMemo(
        () => (bundleQuery.data ?? []).map(normalizeBundleRecord).find((record) => record?.id === bundleId),
        [bundleId, bundleQuery.data],
    );
    const collectionError = bundleStore?.utils.lastError;
    const queryError = collectionError;
    const queryIsLoading = canLoadPullRequest ? bundleQuery.isLoading && !queryData : false;
    const queryIsFetching = canLoadPullRequest ? fetchActivity.activeFetches.some((fetch) => fetch.scopeId === fetchScopeId) : false;
    const refetchQuery = useCallback(() => bundleStore?.utils.refetch({ throwOnError: false }) ?? Promise.resolve(), [bundleStore]);

    const query = useMemo(
        () => ({
            data: queryData,
            error: queryError,
            isLoading: queryIsLoading,
            isFetching: queryIsFetching,
            refetch: refetchQuery,
        }),
        [queryData, queryError, queryIsLoading, queryIsFetching, refetchQuery],
    );

    const hasPendingBuildStatuses = queryData?.buildStatuses?.some((status) => status.state === "pending") ?? false;

    useEffect(() => {
        if (!bundleStore) return;
        // Force a network refresh on mount to replace stale in-memory rows from previous runtime shape changes.
        void bundleStore.utils.refetch({ throwOnError: false });
    }, [bundleStore]);

    useEffect(() => {
        if (!hasPendingBuildStatuses) return;
        const intervalId = window.setInterval(() => {
            if (queryIsFetching) return;
            void refetchQuery();
        }, 10_000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [hasPendingBuildStatuses, queryIsFetching, refetchQuery]);

    useEffect(() => {
        if (!queryError || canWrite || !isRateLimitedError(queryError)) return;
        onRequireAuth?.("rate_limit");
    }, [canWrite, onRequireAuth, queryError]);

    return {
        hostCapabilities,
        query,
    };
}
