import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { type DiffContextState, type FullFileContext, splitFileIntoLines } from "@/features/review/model/full-file-context";
import { fileContextQuery } from "@/lib/git-host/queries";
import type { PullRequestRef } from "@/lib/git-host/types";

type RequestedFile = { path: string; oldPath?: string; newPath?: string; error?: string };

// A stable `combine` makes useQueries return the same array until a query changes, which keeps the memo below effective.
function combineResults<T>(results: T) {
    return results;
}

/** Full file contents, loaded on request, let a file's diff expand beyond the patch context. */
export function useReviewFileContexts({ prRef, baseCommitHash, headCommitHash }: { prRef: PullRequestRef; baseCommitHash?: string; headCommitHash?: string }) {
    const revision = `${baseCommitHash ?? ""}:${headCommitHash ?? ""}`;
    const [requested, setRequested] = useState<{ revision: string; files: RequestedFile[] }>({ revision, files: [] });
    // Requested contents belong to one base/head pair.
    if (requested.revision !== revision) setRequested({ revision, files: [] });

    const queryClient = useQueryClient();
    const loadFullFileContext = useCallback(
        (path: string, fileDiff: FileDiffMetadata) => {
            const oldPath = fileDiff.type === "new" ? undefined : (fileDiff.prevName ?? fileDiff.name ?? path).trim();
            const newPath = fileDiff.type === "deleted" ? undefined : (fileDiff.name ?? fileDiff.prevName ?? path).trim();
            const error =
                oldPath && !baseCommitHash
                    ? "Base commit is unavailable for this pull request."
                    : newPath && !headCommitHash
                      ? "Head commit is unavailable for this pull request."
                      : undefined;
            setRequested((prev) => ({ ...prev, files: [...prev.files.filter((file) => file.path !== path), { path, oldPath, newPath, error }] }));
            // A retry after a failure must fetch again; a failed query does not refetch on its own.
            const { queryKey } = fileContextQuery(prRef, { baseCommit: baseCommitHash ?? "", headCommit: headCommitHash ?? "", oldPath, newPath });
            if (queryClient.getQueryState(queryKey)?.status === "error") void queryClient.resetQueries({ queryKey, exact: true });
        },
        [baseCommitHash, headCommitHash, prRef, queryClient],
    );

    const results = useQueries({
        queries: requested.files.map((file) => ({
            ...fileContextQuery(prRef, { baseCommit: baseCommitHash ?? "", headCommit: headCommitHash ?? "", oldPath: file.oldPath, newPath: file.newPath }),
            enabled: !file.error,
        })),
        combine: combineResults,
    });

    return useMemo(() => {
        const fileContextStatus: Record<string, DiffContextState> = {};
        const readyFileContexts: Record<string, FullFileContext> = {};
        requested.files.forEach((file, index) => {
            const result = results[index];
            if (file.error || result?.error) {
                const message = file.error ?? (result?.error instanceof Error ? result.error.message : "Unable to load file context.");
                fileContextStatus[file.path] = { status: "error", error: message };
            } else if (result?.data) {
                fileContextStatus[file.path] = { status: "ready" };
                readyFileContexts[file.path] = { oldLines: splitFileIntoLines(result.data.oldContents), newLines: splitFileIntoLines(result.data.newContents) };
            } else {
                fileContextStatus[file.path] = { status: "loading" };
            }
        });
        return { fileContextStatus, readyFileContexts, loadFullFileContext };
    }, [loadFullFileContext, requested.files, results]);
}
