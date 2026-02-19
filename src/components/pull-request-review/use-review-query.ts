import { useLiveQuery } from "@tanstack/react-db";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
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
import { type GitHost, HostApiError, type PullRequestCriticalBundle, type PullRequestDeferredBundle } from "@/lib/git-host/types";
import { isReviewPerfV2Enabled } from "@/lib/review-performance/feature-flag";
import { markReviewPerf, measureReviewPerf, setCriticalLoadDuration, setDeferredLoadDuration } from "@/lib/review-performance/metrics";

interface UseReviewQueryProps {
    host: GitHost;
    workspace: string;
    repo: string;
    pullRequestId: string;
    canRead: boolean;
    canWrite: boolean;
    onRequireAuth?: (reason: "rate_limit") => void;
}

const CRITICAL_STALE_MS = 30_000;
const DEFERRED_STALE_MS = 2 * 60_000;

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
    const raw = value as PullRequestBundleRecord;
    return {
        ...raw,
        diffstat: Array.isArray(parsed.diffstat) ? (parsed.diffstat as PullRequestBundleRecord["diffstat"]) : [],
        commits: Array.isArray(parsed.commits) ? (parsed.commits as PullRequestBundleRecord["commits"]) : [],
        comments: Array.isArray(parsed.comments) ? (parsed.comments as PullRequestBundleRecord["comments"]) : [],
        history: Array.isArray(parsed.history) ? (parsed.history as PullRequestBundleRecord["history"]) : [],
        reviewers: Array.isArray(parsed.reviewers) ? (parsed.reviewers as PullRequestBundleRecord["reviewers"]) : [],
        buildStatuses: Array.isArray(parsed.buildStatuses) ? (parsed.buildStatuses as PullRequestBundleRecord["buildStatuses"]) : [],
        deferredStatus: raw.deferredStatus === "ready" || raw.deferredStatus === "loading" || raw.deferredStatus === "error" ? raw.deferredStatus : "idle",
    };
}

export function useReviewQuery({ host, workspace, repo, pullRequestId, canRead, canWrite, onRequireAuth }: UseReviewQueryProps) {
    const perfV2Enabled = isReviewPerfV2Enabled();
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
        return getPullRequestBundleCollection(
            {
                host,
                workspace,
                repo,
                pullRequestId,
            },
            {
                staged: perfV2Enabled,
            },
        );
    }, [canLoadPullRequest, host, hostDataCollectionsVersion, perfV2Enabled, pullRequestId, repo, workspace]);

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

    const critical = useMemo<PullRequestCriticalBundle | undefined>(() => {
        if (!queryData) return undefined;
        return {
            prRef: queryData.prRef,
            pr: queryData.pr,
            diff: queryData.diff,
            diffstat: queryData.diffstat,
            commits: queryData.commits,
        };
    }, [queryData]);

    const deferred = useMemo<PullRequestDeferredBundle | undefined>(() => {
        if (!queryData) return undefined;
        return {
            prRef: queryData.prRef,
            comments: queryData.comments,
            history: queryData.history,
            reviewers: queryData.reviewers,
            buildStatuses: queryData.buildStatuses,
        };
    }, [queryData]);

    const stagedBundle = useMemo(() => {
        if (!critical) return undefined;
        return {
            ...critical,
            comments: deferred?.comments ?? [],
            history: deferred?.history,
            reviewers: deferred?.reviewers,
            buildStatuses: deferred?.buildStatuses,
        };
    }, [critical, deferred]);

    const collectionError = bundleStore?.utils.lastError;
    const queryError = collectionError;
    const queryIsFetching = canLoadPullRequest ? fetchActivity.activeFetches.some((fetch) => fetch.scopeId.startsWith(fetchScopeId)) : false;
    const isCriticalLoading = canLoadPullRequest ? !critical && (bundleQuery.isLoading || queryIsFetching) : false;
    const isDeferredLoading = canLoadPullRequest ? Boolean(critical) && (!queryData?.deferredFetchedAt || queryData?.deferredStatus === "loading") : false;
    const refetchQuery = useCallback(() => bundleStore?.utils.refetch({ throwOnError: false }) ?? Promise.resolve(), [bundleStore]);

    const query = useMemo(
        () => ({
            data: stagedBundle,
            error: queryError,
            isLoading: isCriticalLoading,
            isFetching: queryIsFetching,
            refetch: refetchQuery,
        }),
        [isCriticalLoading, queryError, queryIsFetching, refetchQuery, stagedBundle],
    );

    const criticalMarkRef = useRef<string>("");
    const deferredMarkRef = useRef<string>("");
    useEffect(() => {
        if (critical || criticalMarkRef.current) return;
        criticalMarkRef.current = markReviewPerf("critical_data_start");
    }, [critical]);
    useEffect(() => {
        if (!critical || !criticalMarkRef.current) return;
        const endMark = markReviewPerf("critical_data_ready");
        const duration = measureReviewPerf("critical_data", criticalMarkRef.current, endMark);
        if (typeof duration === "number") {
            setCriticalLoadDuration(duration);
        }
        criticalMarkRef.current = "";
    }, [critical]);

    useEffect(() => {
        if (queryData?.deferredFetchedAt || deferredMarkRef.current) return;
        deferredMarkRef.current = markReviewPerf("deferred_data_start");
    }, [queryData?.deferredFetchedAt]);
    useEffect(() => {
        if (!queryData?.deferredFetchedAt || !deferredMarkRef.current) return;
        const endMark = markReviewPerf("deferred_data_ready");
        const duration = measureReviewPerf("deferred_data", deferredMarkRef.current, endMark);
        if (typeof duration === "number") {
            setDeferredLoadDuration(duration);
        }
        deferredMarkRef.current = "";
    }, [queryData?.deferredFetchedAt]);

    const hasPendingBuildStatuses = stagedBundle?.buildStatuses?.some((status) => status.state === "pending") ?? false;

    useEffect(() => {
        if (!bundleStore) return;
        if (!perfV2Enabled) {
            void bundleStore.utils.refetch({ throwOnError: false });
            return;
        }
        if (queryIsFetching) return;

        const now = Date.now();
        const criticalFetchedAt = queryData?.criticalFetchedAt ?? queryData?.fetchedAt ?? 0;
        const deferredFetchedAt = queryData?.deferredFetchedAt ?? 0;
        const criticalStale = !criticalFetchedAt || now - criticalFetchedAt > CRITICAL_STALE_MS;
        const deferredStale = !deferredFetchedAt || now - deferredFetchedAt > DEFERRED_STALE_MS;

        if (!queryData || criticalStale || deferredStale) {
            void bundleStore.utils.refetch({ throwOnError: false });
        }
    }, [bundleStore, perfV2Enabled, queryData, queryIsFetching]);

    useEffect(() => {
        if (!hasPendingBuildStatuses) return;
        const poll = () => {
            if (queryIsFetching) return;
            if (typeof document !== "undefined" && document.hidden) return;
            void refetchQuery();
        };
        const intervalId = window.setInterval(poll, 10_000);
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
        critical,
        deferred,
        isCriticalLoading,
        isDeferredLoading,
        isRefreshing: queryIsFetching,
        query,
    };
}
