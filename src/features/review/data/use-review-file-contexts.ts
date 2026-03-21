import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiffContextState } from "@/components/pull-request-review/diff-context-button";
import { type FullFileContextEntry, splitFileIntoLines } from "@/features/review/model/review-page-controller-helpers";
import { savePullRequestFileContextRecord } from "@/lib/git-host/query-collections";
import { fetchPullRequestFileContents } from "@/lib/git-host/service";
import type { GitHost } from "@/lib/git-host/types";

type PullRequestRef = {
    host: GitHost;
    workspace: string;
    repo: string;
    pullRequestId: string;
};

type UseReviewFileContextsParams = {
    effectiveBaseCommitHash?: string;
    effectiveHeadCommitHash?: string;
    historyRevision: string;
    persistedFileContexts: Record<string, { oldLines: string[]; newLines: string[]; fetchedAt: number }>;
    prRef: PullRequestRef;
    resolvedScopeMode: "full" | "range";
};

export function useReviewFileContexts({
    effectiveBaseCommitHash,
    effectiveHeadCommitHash,
    historyRevision,
    persistedFileContexts,
    prRef,
    resolvedScopeMode,
}: UseReviewFileContextsParams) {
    const [fileContexts, setFileContexts] = useState<Record<string, FullFileContextEntry>>({});
    const readyFileContextsRef = useRef<Record<string, { oldLines: string[]; newLines: string[] }>>({});

    const readyFileContexts = useMemo(() => {
        const prevEntries = readyFileContextsRef.current;
        const nextEntries: Record<string, { oldLines: string[]; newLines: string[] }> = {};
        let changed = false;

        for (const [path, entry] of Object.entries(fileContexts)) {
            if (entry.status !== "ready") continue;
            const prev = prevEntries[path];
            if (prev && prev.oldLines === entry.oldLines && prev.newLines === entry.newLines) {
                nextEntries[path] = prev;
                continue;
            }
            nextEntries[path] = { oldLines: entry.oldLines, newLines: entry.newLines };
            changed = true;
        }

        const prevKeys = Object.keys(prevEntries);
        const nextKeys = Object.keys(nextEntries);
        const hasKeyChange = prevKeys.length !== nextKeys.length || prevKeys.some((key) => nextEntries[key] !== prevEntries[key]);

        if (!changed && !hasKeyChange) {
            return prevEntries;
        }

        readyFileContextsRef.current = nextEntries;
        return nextEntries;
    }, [fileContexts]);

    const fileContextStatus = useMemo(() => {
        const entries: Record<string, DiffContextState> = {};
        for (const [path, entry] of Object.entries(fileContexts)) {
            if (entry.status === "loading" || entry.status === "idle") {
                entries[path] = entry;
            } else if (entry.status === "ready") {
                entries[path] = { status: "ready" };
            } else {
                entries[path] = { status: "error", error: entry.error };
            }
        }
        return entries;
    }, [fileContexts]);

    useEffect(() => {
        setFileContexts((prev) => {
            let changed = false;
            const next: Record<string, FullFileContextEntry> = { ...prev };

            for (const [path, context] of Object.entries(persistedFileContexts)) {
                const existing = next[path];
                if (existing?.status === "ready" && existing.fetchedAt === context.fetchedAt) {
                    continue;
                }
                next[path] = {
                    status: "ready",
                    oldLines: context.oldLines,
                    newLines: context.newLines,
                    fetchedAt: context.fetchedAt,
                };
                changed = true;
            }

            for (const [path, entry] of Object.entries(next)) {
                if (entry.status === "ready" && !persistedFileContexts[path]) {
                    delete next[path];
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [persistedFileContexts]);

    useEffect(() => {
        void historyRevision;
        setFileContexts({});
    }, [historyRevision]);

    const handleLoadFullFileContext = useCallback(
        async (filePath: string, fileDiff: FileDiffMetadata) => {
            const current = fileContexts[filePath];
            if (current?.status === "loading") return;
            if (current?.status === "ready" || persistedFileContexts[filePath]) return;
            setFileContexts((prev) => ({ ...prev, [filePath]: { status: "loading" } }));
            try {
                const baseCommit = effectiveBaseCommitHash;
                const headCommit = effectiveHeadCommitHash;
                const needsBase = fileDiff.type !== "new";
                const needsHead = fileDiff.type !== "deleted";
                if (needsBase && !baseCommit) {
                    throw new Error("Base commit is unavailable for this pull request.");
                }
                if (needsHead && !headCommit) {
                    throw new Error("Head commit is unavailable for this pull request.");
                }
                const oldPath = (fileDiff.prevName ?? fileDiff.name ?? filePath).trim();
                const newPath = (fileDiff.name ?? fileDiff.prevName ?? filePath).trim();
                const [oldContent, newContent] = await Promise.all([
                    needsBase ? fetchPullRequestFileContents({ prRef, commit: baseCommit ?? "", path: oldPath }) : Promise.resolve(""),
                    needsHead ? fetchPullRequestFileContents({ prRef, commit: headCommit ?? "", path: newPath }) : Promise.resolve(""),
                ]);
                const readyOldLines = needsBase ? splitFileIntoLines(oldContent) : [];
                const readyNewLines = needsHead ? splitFileIntoLines(newContent) : [];
                const fetchedAt = Date.now();
                if (resolvedScopeMode === "full") {
                    await savePullRequestFileContextRecord({
                        prRef,
                        path: filePath,
                        oldLines: readyOldLines,
                        newLines: readyNewLines,
                        fetchedAt,
                    });
                }
                setFileContexts((prev) => ({
                    ...prev,
                    [filePath]: {
                        status: "ready",
                        oldLines: readyOldLines,
                        newLines: readyNewLines,
                        fetchedAt,
                    },
                }));
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unable to load file context.";
                setFileContexts((prev) => ({ ...prev, [filePath]: { status: "error", error: message } }));
            }
        },
        [effectiveBaseCommitHash, effectiveHeadCommitHash, fileContexts, persistedFileContexts, prRef, resolvedScopeMode],
    );

    return {
        fileContextStatus,
        handleLoadFullFileContext,
        readyFileContexts,
    };
}
