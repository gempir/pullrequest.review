import { useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useReviewQuery } from "@/components/pull-request-review/use-review-query";
import { useViewedStorageKey } from "@/components/pull-request-review/use-review-storage";
import { sameScopeSearch } from "@/features/review/model/review-page-controller-helpers";
import {
    getHostDataCollectionsVersionSnapshot,
    getPullRequestCommitRangeDiffCollection,
    getPullRequestCommitRangeDiffDataCollection,
    getPullRequestFileContextCollection,
    getPullRequestFileHistoryDataCollection,
    type PullRequestCommitRangeDiffRecord,
    subscribeHostDataCollectionsVersion,
} from "@/lib/git-host/query-collections";
import type { GitHost } from "@/lib/git-host/types";
import { diffScopeStorageSegment, type ReviewDiffScopeSearch, resolveReviewDiffScope } from "@/lib/review-diff-scope";

type ReviewScopedDataParams = {
    host: GitHost;
    workspace: string;
    repo: string;
    pullRequestId: string;
    auth: { canWrite: boolean; canRead: boolean };
    reviewDiffScopeSearch?: ReviewDiffScopeSearch;
    onReviewDiffScopeSearchChange?: (next: ReviewDiffScopeSearch) => void;
    requestAuth: (reason: "write" | "rate_limit") => void;
};

export function useReviewScopedData({
    host,
    workspace,
    repo,
    pullRequestId,
    auth,
    reviewDiffScopeSearch,
    onReviewDiffScopeSearchChange,
    requestAuth,
}: ReviewScopedDataParams) {
    const hostDataCollectionsVersion = useSyncExternalStore(
        subscribeHostDataCollectionsVersion,
        getHostDataCollectionsVersionSnapshot,
        getHostDataCollectionsVersionSnapshot,
    );
    const [scopeNotice, setScopeNotice] = useState<string | null>(null);
    const diffScopeSearch = reviewDiffScopeSearch ?? {};
    const {
        hostCapabilities,
        isCriticalLoading,
        isDeferredLoading,
        isRefreshing,
        query: prQuery,
    } = useReviewQuery({
        host,
        workspace,
        repo,
        pullRequestId,
        canRead: auth.canRead,
        canWrite: auth.canWrite,
        onRequireAuth: requestAuth,
    });
    const basePrData = prQuery.data;
    const prRef = useMemo(() => ({ host, workspace, repo, pullRequestId }), [host, pullRequestId, repo, workspace]);
    const prContextKey = `${host}:${workspace}/${repo}/${pullRequestId}`;
    const resolvedScope = useMemo(
        () =>
            resolveReviewDiffScope({
                search: diffScopeSearch,
                commits: basePrData?.commits ?? [],
                destinationCommitHash: basePrData?.pr.destination?.commit?.hash,
            }),
        [basePrData?.commits, basePrData?.pr.destination?.commit?.hash, diffScopeSearch],
    );
    const diffScopeSegment = useMemo(() => diffScopeStorageSegment(resolvedScope), [resolvedScope]);
    const viewedStorageKey = useViewedStorageKey(basePrData?.prRef, diffScopeSegment);
    const commitRangeDiffCollectionData = useMemo(() => {
        void hostDataCollectionsVersion;
        return getPullRequestCommitRangeDiffDataCollection();
    }, [hostDataCollectionsVersion]);
    const fileContextCollection = useMemo(() => {
        void hostDataCollectionsVersion;
        return getPullRequestFileContextCollection();
    }, [hostDataCollectionsVersion]);
    const fileHistoryCollection = useMemo(() => {
        void hostDataCollectionsVersion;
        return getPullRequestFileHistoryDataCollection();
    }, [hostDataCollectionsVersion]);
    const commitRangeDiffQuery = useLiveQuery(
        (q) => q.from({ range: commitRangeDiffCollectionData }).select(({ range }) => ({ ...range })),
        [commitRangeDiffCollectionData],
    );
    const fileContextQuery = useLiveQuery((q) => q.from({ context: fileContextCollection }).select(({ context }) => ({ ...context })), [fileContextCollection]);
    const fileHistoryQuery = useLiveQuery((q) => q.from({ history: fileHistoryCollection }).select(({ history }) => ({ ...history })), [fileHistoryCollection]);
    const persistedFileContexts = useMemo(() => {
        if (resolvedScope.mode !== "full") return {};
        const entries: Record<string, { oldLines: string[]; newLines: string[]; fetchedAt: number }> = {};
        for (const record of fileContextQuery.data ?? []) {
            if (record.prKey !== prContextKey) continue;
            entries[record.path] = {
                oldLines: record.oldLines,
                newLines: record.newLines,
                fetchedAt: record.fetchedAt,
            };
        }
        return entries;
    }, [fileContextQuery.data, prContextKey, resolvedScope.mode]);
    const persistedFileHistoryByPath = useMemo(() => {
        const entries: Record<
            string,
            {
                entries: NonNullable<(typeof fileHistoryQuery.data)[number]["entries"]>;
                fetchedAt: number;
            }
        > = {};
        for (const record of fileHistoryQuery.data ?? []) {
            if (record.prKey !== prContextKey) continue;
            entries[record.path] = {
                entries: record.entries,
                fetchedAt: record.fetchedAt,
            };
        }
        return entries;
    }, [fileHistoryQuery.data, prContextKey]);
    const persistedCommitRangeDiffs = useMemo(() => {
        const entries: Record<string, PullRequestCommitRangeDiffRecord> = {};
        for (const record of commitRangeDiffQuery.data ?? []) {
            if (record.prKey !== prContextKey) continue;
            entries[`${record.baseCommitHash}..${record.headCommitHash}`] = record;
        }
        return entries;
    }, [commitRangeDiffQuery.data, prContextKey]);
    const scopedRangeDiffRecord = useMemo(() => {
        if (resolvedScope.mode === "full") return undefined;
        if (!resolvedScope.baseCommitHash || !resolvedScope.headCommitHash) return undefined;
        return persistedCommitRangeDiffs[`${resolvedScope.baseCommitHash}..${resolvedScope.headCommitHash}`];
    }, [persistedCommitRangeDiffs, resolvedScope]);
    const commitRangeScopedCollection = useMemo(() => {
        if (!basePrData || resolvedScope.mode === "full") return null;
        if (!resolvedScope.baseCommitHash || !resolvedScope.headCommitHash) return null;
        if (resolvedScope.selectedCommitHashes.length === 0) return null;
        return getPullRequestCommitRangeDiffCollection({
            prRef,
            baseCommitHash: resolvedScope.baseCommitHash,
            headCommitHash: resolvedScope.headCommitHash,
            selectedCommitHashes: resolvedScope.selectedCommitHashes,
        });
    }, [basePrData, prRef, resolvedScope]);
    const effectivePrData = useMemo(() => {
        if (!basePrData) return undefined;
        if (resolvedScope.mode === "full") return basePrData;
        if (resolvedScope.selectedCommitHashes.length === 0) {
            return {
                ...basePrData,
                diff: "",
                diffstat: [],
                commits: resolvedScope.selectedCommits,
            };
        }
        if (!scopedRangeDiffRecord) {
            return {
                ...basePrData,
                diff: "",
                diffstat: [],
                commits: resolvedScope.selectedCommits,
            };
        }
        return {
            ...basePrData,
            diff: scopedRangeDiffRecord.diff,
            diffstat: scopedRangeDiffRecord.diffstat,
            commits: resolvedScope.selectedCommits,
        };
    }, [basePrData, resolvedScope, scopedRangeDiffRecord]);
    const commitScopeLoading = resolvedScope.mode === "range" && resolvedScope.selectedCommitHashes.length > 0 && !scopedRangeDiffRecord;

    useEffect(() => {
        if (!onReviewDiffScopeSearchChange) return;
        if (sameScopeSearch(diffScopeSearch, resolvedScope.normalizedSearch)) return;
        onReviewDiffScopeSearchChange(resolvedScope.normalizedSearch);
    }, [diffScopeSearch, onReviewDiffScopeSearchChange, resolvedScope.normalizedSearch]);

    useEffect(() => {
        if (!onReviewDiffScopeSearchChange) return;
        if (resolvedScope.mode !== "full" || !resolvedScope.fallbackReason || !diffScopeSearch.from || !diffScopeSearch.to) return;
        const notice =
            resolvedScope.fallbackReason === "invalid_range"
                ? "Selected commit range is unavailable. Switched to full diff."
                : "Commit range base/head could not be resolved. Switched to full diff.";
        setScopeNotice(notice);
        onReviewDiffScopeSearchChange({});
    }, [diffScopeSearch.from, diffScopeSearch.to, onReviewDiffScopeSearchChange, resolvedScope]);

    useEffect(() => {
        if (!commitRangeScopedCollection) return;
        let cancelled = false;
        setScopeNotice(null);
        void (async () => {
            await commitRangeScopedCollection.utils.refetch({ throwOnError: false });
            if (cancelled) return;
            const maybeError = commitRangeScopedCollection.utils.lastError;
            if (!maybeError) return;
            const message = maybeError instanceof Error ? maybeError.message : "Failed to load commit range diff.";
            setScopeNotice(message);
            onReviewDiffScopeSearchChange?.({});
        })();
        return () => {
            cancelled = true;
        };
    }, [commitRangeScopedCollection, onReviewDiffScopeSearchChange]);

    useEffect(() => {
        if (resolvedScope.mode === "full") return;
        if (resolvedScope.selectedCommitHashes.length > 0) return;
        setScopeNotice("No changes in selected range.");
    }, [resolvedScope.mode, resolvedScope.selectedCommitHashes.length]);

    return {
        commitRangeScopedCollection,
        commitScopeLoading,
        effectivePrData,
        hostCapabilities,
        isCriticalLoading,
        isDeferredLoading,
        isPrQueryFetching: isRefreshing || isDeferredLoading,
        persistedFileContexts,
        persistedFileHistoryByPath,
        prContextKey,
        prQuery,
        prRef,
        resolvedScope,
        scopeNotice,
        setScopeNotice,
        viewedStorageKey,
    };
}
