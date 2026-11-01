import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useCallback, useState } from "react";
import type { DiffContextState } from "@/features/review/components/diff-context-button";
import { getHostClient } from "@/lib/git-host/registry";
import type { PullRequestRef } from "@/lib/git-host/types";

export type FullFileContext = { oldLines: string[]; newLines: string[] };

function splitFileIntoLines(contents: string) {
    return contents.replace(/\r\n/g, "\n").match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

export function useReviewFileContexts({ prRef, baseCommitHash, headCommitHash }: { prRef: PullRequestRef; baseCommitHash?: string; headCommitHash?: string }) {
    const revision = `${baseCommitHash ?? ""}:${headCommitHash ?? ""}`;
    const [state, setState] = useState<{ revision: string; status: Record<string, DiffContextState>; ready: Record<string, FullFileContext> }>({
        revision,
        status: {},
        ready: {},
    });
    // Loaded file contents belong to one base/head pair.
    if (state.revision !== revision) setState({ revision, status: {}, ready: {} });

    const loadFullFileContext = useCallback(
        async (filePath: string, fileDiff: FileDiffMetadata) => {
            const setStatus = (status: DiffContextState) => setState((prev) => ({ ...prev, status: { ...prev.status, [filePath]: status } }));
            setStatus({ status: "loading" });
            try {
                const needsBase = fileDiff.type !== "new";
                const needsHead = fileDiff.type !== "deleted";
                if (needsBase && !baseCommitHash) throw new Error("Base commit is unavailable for this pull request.");
                if (needsHead && !headCommitHash) throw new Error("Head commit is unavailable for this pull request.");
                const client = getHostClient(prRef.host);
                const [oldContent, newContent] = await Promise.all([
                    needsBase
                        ? client.fetchPullRequestFileContents({
                              prRef,
                              commit: baseCommitHash ?? "",
                              path: (fileDiff.prevName ?? fileDiff.name ?? filePath).trim(),
                          })
                        : "",
                    needsHead
                        ? client.fetchPullRequestFileContents({
                              prRef,
                              commit: headCommitHash ?? "",
                              path: (fileDiff.name ?? fileDiff.prevName ?? filePath).trim(),
                          })
                        : "",
                ]);
                const context = { oldLines: splitFileIntoLines(oldContent), newLines: splitFileIntoLines(newContent) };
                setState((prev) => ({
                    ...prev,
                    status: { ...prev.status, [filePath]: { status: "ready" } },
                    ready: { ...prev.ready, [filePath]: context },
                }));
            } catch (error) {
                setStatus({ status: "error", error: error instanceof Error ? error.message : "Unable to load file context." });
            }
        },
        [baseCommitHash, headCommitHash, prRef],
    );

    return { fileContextStatus: state.status, readyFileContexts: state.ready, loadFullFileContext };
}
