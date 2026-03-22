import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type CreateCommentPayload, commentMatchKey } from "@/features/review/model/review-page-controller-helpers";
import type { PullRequestBundle, Comment as PullRequestComment } from "@/lib/git-host/types";

type UseReviewOptimisticCommentsParams = {
    currentUserAvatarUrl?: string;
    currentUserDisplayName?: string;
    effectivePrData: PullRequestBundle | undefined;
    prContextKey: string;
};

export function useReviewOptimisticComments({
    currentUserAvatarUrl,
    currentUserDisplayName,
    effectivePrData,
    prContextKey,
}: UseReviewOptimisticCommentsParams) {
    const [optimisticComments, setOptimisticComments] = useState<PullRequestComment[]>([]);
    const optimisticCommentIdRef = useRef(-1);

    const removeMatchedOptimisticComments = useCallback((serverComments: PullRequestComment[]) => {
        const serverKeyCounts = new Map<string, number>();
        for (const comment of serverComments) {
            const key = commentMatchKey(comment);
            serverKeyCounts.set(key, (serverKeyCounts.get(key) ?? 0) + 1);
        }
        setOptimisticComments((prev) => {
            let changed = false;
            const next: PullRequestComment[] = [];
            const remainingCounts = new Map(serverKeyCounts);
            for (const optimisticComment of prev) {
                const key = commentMatchKey(optimisticComment);
                const matchedCount = remainingCounts.get(key) ?? 0;
                if (matchedCount > 0) {
                    changed = true;
                    remainingCounts.set(key, matchedCount - 1);
                    continue;
                }
                next.push(optimisticComment);
            }
            return changed ? next : prev;
        });
    }, []);

    const createOptimisticComment = useCallback(
        (payload: CreateCommentPayload) => {
            if (!effectivePrData) return null;
            const optimisticCommentId = optimisticCommentIdRef.current;
            optimisticCommentIdRef.current -= 1;
            const now = new Date().toISOString();
            const nextComment: PullRequestComment = {
                id: optimisticCommentId,
                createdAt: now,
                updatedAt: now,
                deleted: false,
                pending: true,
                content: { raw: payload.content },
                user: {
                    displayName: currentUserDisplayName ?? "You",
                    avatarUrl: currentUserAvatarUrl,
                },
                inline: payload.path
                    ? {
                          path: payload.path,
                          to: payload.side === "deletions" ? undefined : payload.line,
                          from: payload.side === "deletions" ? payload.line : undefined,
                      }
                    : undefined,
                parent: payload.parentId ? { id: payload.parentId } : undefined,
            };
            setOptimisticComments((prev) => [...prev, nextComment]);
            return optimisticCommentId;
        },
        [currentUserAvatarUrl, currentUserDisplayName, effectivePrData],
    );

    const updateOptimisticCommentPending = useCallback((commentId: number, pending: boolean) => {
        setOptimisticComments((prev) => {
            let changed = false;
            const next = prev.map((comment) => {
                if (comment.id !== commentId) return comment;
                if (comment.pending === pending) return comment;
                changed = true;
                return {
                    ...comment,
                    pending,
                    updatedAt: new Date().toISOString(),
                };
            });
            return changed ? next : prev;
        });
    }, []);

    const removeOptimisticComment = useCallback((commentId: number) => {
        setOptimisticComments((prev) => prev.filter((comment) => comment.id !== commentId));
    }, []);

    useEffect(() => {
        if (!effectivePrData?.comments?.length) return;
        if (optimisticComments.length === 0) return;
        removeMatchedOptimisticComments(effectivePrData.comments);
    }, [effectivePrData?.comments, optimisticComments.length, removeMatchedOptimisticComments]);

    useEffect(() => {
        if (!prContextKey) return;
        setOptimisticComments([]);
    }, [prContextKey]);

    const prData = useMemo(() => {
        if (!effectivePrData) return undefined;
        if (optimisticComments.length === 0) return effectivePrData;
        const serverComments = effectivePrData.comments ?? [];
        const serverKeyCounts = new Map<string, number>();
        for (const comment of serverComments) {
            const key = commentMatchKey(comment);
            serverKeyCounts.set(key, (serverKeyCounts.get(key) ?? 0) + 1);
        }

        const unmatchedOptimisticComments: PullRequestComment[] = [];
        const remainingCounts = new Map(serverKeyCounts);
        for (const comment of optimisticComments) {
            const key = commentMatchKey(comment);
            const matchedCount = remainingCounts.get(key) ?? 0;
            if (matchedCount > 0) {
                remainingCounts.set(key, matchedCount - 1);
                continue;
            }
            unmatchedOptimisticComments.push(comment);
        }

        if (unmatchedOptimisticComments.length === 0) return effectivePrData;
        return {
            ...effectivePrData,
            comments: [...serverComments, ...unmatchedOptimisticComments],
        };
    }, [effectivePrData, optimisticComments]);

    return {
        createOptimisticComment,
        prData,
        removeOptimisticComment,
        updateOptimisticCommentPending,
    };
}
