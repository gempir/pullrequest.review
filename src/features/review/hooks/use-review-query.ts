import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { pullRequestCriticalQuery, pullRequestDeferredQuery } from "@/lib/git-host/queries";
import { getHostCapabilities, getHostClient } from "@/lib/git-host/registry";
import { HostApiError, type PullRequestBundle, type PullRequestRef } from "@/lib/git-host/types";

const PENDING_BUILD_POLL_MS = 10_000;

export function isRateLimitedError(error: unknown) {
    if (!error) return false;
    if (error instanceof HostApiError) return error.status === 429 || error.status === 403;
    return error instanceof Error && (error.message.includes("429") || error.message.includes("403"));
}

export function useReviewQuery({
    prRef,
    canRead,
    canWrite,
    onRequireAuth,
}: {
    prRef: PullRequestRef;
    canRead: boolean;
    canWrite: boolean;
    onRequireAuth?: (reason: "rate_limit") => void;
}) {
    const queryClient = useQueryClient();
    const hostCapabilities = getHostCapabilities(prRef.host);
    const enabled = canRead || hostCapabilities.publicReadSupported;
    const critical = useQuery({ ...pullRequestCriticalQuery(prRef), enabled });
    const deferred = useQuery({
        ...pullRequestDeferredQuery(prRef),
        enabled: enabled && critical.isSuccess,
        refetchInterval: (query) => (query.state.data?.buildStatuses?.some((status) => status.state === "pending") ? PENDING_BUILD_POLL_MS : false),
    });

    const data = useMemo<PullRequestBundle | undefined>(() => {
        if (!critical.data) return undefined;
        return {
            ...critical.data,
            pr: deferred.data?.prPatch ? { ...critical.data.pr, ...deferred.data.prPatch } : critical.data.pr,
            comments: deferred.data?.comments ?? [],
            history: deferred.data?.history,
            reviewers: deferred.data?.reviewers,
            buildStatuses: deferred.data?.buildStatuses,
        };
    }, [critical.data, deferred.data]);

    const refetchCritical = critical.refetch;
    const refetchDeferred = deferred.refetch;
    const refetch = useCallback(async () => {
        await Promise.all([refetchCritical(), refetchDeferred()]);
    }, [refetchCritical, refetchDeferred]);

    const refetchComments = useCallback(async () => {
        try {
            const comments = await getHostClient(prRef.host).fetchPullRequestCommentsByRef({ prRef });
            queryClient.setQueryData(pullRequestDeferredQuery(prRef).queryKey, (current) => (current ? { ...current, comments } : current));
        } catch {
            // Keep a successful comment mutation successful if its follow-up refresh fails.
        }
    }, [prRef, queryClient]);

    const error = critical.error;
    const rateLimited = isRateLimitedError(error);
    useEffect(() => {
        if (rateLimited && !canWrite) onRequireAuth?.("rate_limit");
    }, [canWrite, onRequireAuth, rateLimited]);

    // Signing in lifts the rate limit that blocked the anonymous request.
    const previousCanWriteRef = useRef(canWrite);
    useEffect(() => {
        const signedIn = canWrite && !previousCanWriteRef.current;
        previousCanWriteRef.current = canWrite;
        // eslint-disable-next-line react-doctor/query-no-query-in-effect -- A rate-limit failure is not stale data, so this explicit retry runs once on sign-in.
        if (signedIn && rateLimited) void refetchCritical();
    }, [canWrite, rateLimited, refetchCritical]);

    const isFetching = critical.isFetching || deferred.isFetching;
    return {
        hostCapabilities,
        data,
        error,
        rateLimited,
        isLoading: critical.isLoading,
        isDeferredLoading: deferred.isLoading,
        isFetching,
        loadProgress: isFetching ? (critical.isFetching ? 0 : 50) : null,
        refetch,
        refetchComments,
    };
}
