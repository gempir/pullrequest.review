import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useReviewQuery } from "@/features/review/hooks/use-review-query";
import { commitRangeDiffQuery } from "@/lib/git-host/queries";
import type { PullRequestRef } from "@/lib/git-host/types";
import { type ReviewDiffScopeSearch, resolveReviewDiffScope } from "@/lib/review-diff-scope";

const EMPTY_SCOPE_SEARCH: ReviewDiffScopeSearch = {};

export function useReviewScope({
    prRef,
    auth,
    search = EMPTY_SCOPE_SEARCH,
    onSearchChange,
    requestAuth,
}: {
    prRef: PullRequestRef;
    auth: { canWrite: boolean; canRead: boolean };
    search?: ReviewDiffScopeSearch;
    onSearchChange?: (next: ReviewDiffScopeSearch) => void;
    requestAuth: (reason: "write" | "rate_limit") => void;
}) {
    const [notice, setNotice] = useState<string | null>(null);
    const pr = useReviewQuery({ prRef, canRead: auth.canRead, canWrite: auth.canWrite, onRequireAuth: requestAuth });
    const baseData = pr.data;
    const resolvedScope = useMemo(
        () =>
            resolveReviewDiffScope({
                search,
                commits: baseData?.commits ?? [],
                destinationCommitHash: baseData?.pr.destination?.commit?.hash,
            }),
        [baseData?.commits, baseData?.pr.destination?.commit?.hash, search],
    );
    const { baseCommitHash, headCommitHash, selectedCommitHashes } = resolvedScope;
    const wantsRangeDiff = resolvedScope.mode !== "full" && Boolean(baseData && baseCommitHash && headCommitHash) && selectedCommitHashes.length > 0;
    const rangeDiff = useQuery({
        ...commitRangeDiffQuery(prRef, { baseCommitHash: baseCommitHash ?? "", headCommitHash: headCommitHash ?? "", selectedCommitHashes }),
        enabled: wantsRangeDiff,
    });

    const scopedData = useMemo(() => {
        if (!baseData || resolvedScope.mode === "full") return baseData;
        const diff = wantsRangeDiff ? rangeDiff.data : undefined;
        return { ...baseData, diff: diff?.diff ?? "", diffstat: diff?.diffstat ?? [], commits: resolvedScope.selectedCommits };
    }, [baseData, rangeDiff.data, resolvedScope, wantsRangeDiff]);

    useEffect(() => {
        if (search.from === resolvedScope.normalizedSearch.from && search.to === resolvedScope.normalizedSearch.to) return;
        // eslint-disable-next-line react-doctor/no-pass-data-to-parent, react-doctor/no-pass-live-state-to-parent -- Normalize the route search once commits load; the equality guard prevents a navigation loop.
        onSearchChange?.(resolvedScope.normalizedSearch);
    }, [onSearchChange, resolvedScope.normalizedSearch, search.from, search.to]);

    useEffect(() => {
        if (resolvedScope.mode !== "full" || !resolvedScope.fallbackReason || !search.from) return;
        setNotice(
            resolvedScope.fallbackReason === "invalid_range"
                ? "Selected commit range is unavailable. Switched to full diff."
                : "Commit range base/head could not be resolved. Switched to full diff.",
        );
        onSearchChange?.({});
    }, [onSearchChange, resolvedScope.fallbackReason, resolvedScope.mode, search.from]);

    const rangeError = wantsRangeDiff ? rangeDiff.error : null;
    useEffect(() => {
        if (!rangeError) return;
        setNotice(rangeError instanceof Error ? rangeError.message : "Failed to load commit range diff.");
        onSearchChange?.({});
    }, [onSearchChange, rangeError]);

    const refetchRangeDiff = rangeDiff.refetch;
    const refetch = async () => {
        await pr.refetch();
        if (wantsRangeDiff) await refetchRangeDiff();
    };

    return {
        pr,
        scopedData,
        resolvedScope,
        commitScopeLoading: wantsRangeDiff && !rangeDiff.data,
        scopeNotice: resolvedScope.mode !== "full" && selectedCommitHashes.length === 0 ? "No changes in selected range." : notice,
        setScopeNotice: setNotice,
        refetch,
    };
}
