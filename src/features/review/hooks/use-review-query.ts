import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { pullRequestCommentsQuery, pullRequestCriticalQuery, pullRequestDeferredQuery } from "@/lib/git-host/queries";
import { getHostCapabilities } from "@/lib/git-host/registry";
import { type Comment, HostApiError, type PullRequestBundle, type PullRequestDeferredBundle, type PullRequestRef } from "@/lib/git-host/types";

const PENDING_BUILD_POLL_MS = 10_000;

const EMPTY_DEFERRED: PullRequestDeferredBundle = { history: [], reviewers: [], buildStatuses: [], currentUserReviewStatus: "none" };
const EMPTY_COMMENTS: Comment[] = [];

export function isRateLimitedError(error: unknown) {
    return error instanceof HostApiError && (error.status === 429 || error.status === 403);
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
    onRequireAuth: (reason: "rate_limit") => void;
}) {
    const critical = useQuery({ ...pullRequestCriticalQuery(prRef), enabled: canRead });
    const comments = useQuery({ ...pullRequestCommentsQuery(prRef), enabled: canRead && critical.isSuccess });
    const deferred = useQuery({
        ...pullRequestDeferredQuery(prRef),
        enabled: canRead && critical.isSuccess,
        refetchInterval: (query) => (query.state.data?.buildStatuses.some((status) => status.state === "pending") ? PENDING_BUILD_POLL_MS : false),
    });

    const data = useMemo<PullRequestBundle | undefined>(
        () => (critical.data ? { prRef, ...critical.data, ...(deferred.data ?? EMPTY_DEFERRED), comments: comments.data ?? EMPTY_COMMENTS } : undefined),
        [comments.data, critical.data, deferred.data, prRef],
    );

    const refetchCritical = critical.refetch;
    const refetchComments = comments.refetch;
    const refetchDeferred = deferred.refetch;
    const refetch = useCallback(async () => {
        await Promise.all([refetchCritical(), refetchComments(), refetchDeferred()]);
    }, [refetchComments, refetchCritical, refetchDeferred]);

    const error = critical.error;
    const rateLimited = isRateLimitedError(error);
    useEffect(() => {
        if (rateLimited && !canWrite) onRequireAuth("rate_limit");
    }, [canWrite, onRequireAuth, rateLimited]);

    const isFetching = critical.isFetching || comments.isFetching || deferred.isFetching;
    return {
        hostCapabilities: getHostCapabilities(prRef.host),
        data,
        error,
        rateLimited,
        isLoading: critical.isLoading,
        isCommentsLoading: comments.isLoading,
        isFetching,
        loadProgress: isFetching ? (critical.isFetching ? 0 : 50) : null,
        refetch,
        refetchComments,
    };
}
