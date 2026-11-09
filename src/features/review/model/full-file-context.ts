import type { FileDiffMetadata } from "@pierre/diffs/react";

export type FullFileContext = { oldLines: string[]; newLines: string[] };

export type DiffContextState = { status: "idle" } | { status: "loading" } | { status: "ready" } | { status: "error"; error: string };

export function splitFileIntoLines(contents: string) {
    return contents.replace(/\r\n/g, "\n").match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

/** Rewrites a patch-only file diff so its hunks index into the full old and new file contents, letting the viewer expand context. */
export function applyFullContext(fileDiff: FileDiffMetadata, context: FullFileContext): FileDiffMetadata {
    let splitLineStart = 0;
    let unifiedLineStart = 0;

    const hunks = fileDiff.hunks.map((hunk, index, all) => {
        const collapsedBefore = calculateCollapsedBefore(all, index);
        splitLineStart += collapsedBefore;
        unifiedLineStart += collapsedBefore;

        const nextHunk = {
            ...hunk,
            collapsedBefore,
            additionLineIndex: toFullFileLineIndex(hunk.additionStart),
            deletionLineIndex: toFullFileLineIndex(hunk.deletionStart),
            splitLineStart,
            unifiedLineStart,
        };

        splitLineStart += hunk.splitLineCount;
        unifiedLineStart += hunk.unifiedLineCount;

        return nextHunk;
    });

    const lastHunk = hunks.at(-1);
    const trailingContext =
        lastHunk == null
            ? Math.min(context.oldLines.length, context.newLines.length)
            : Math.max(
                  0,
                  Math.min(
                      context.oldLines.length - (lastHunk.deletionLineIndex + lastHunk.deletionCount),
                      context.newLines.length - (lastHunk.additionLineIndex + lastHunk.additionCount),
                  ),
              );

    return {
        ...fileDiff,
        cacheKey: fileDiff.cacheKey ? `${fileDiff.cacheKey}:full-context:${context.oldLines.length}:${context.newLines.length}` : undefined,
        hunks,
        isPartial: false,
        deletionLines: context.oldLines,
        additionLines: context.newLines,
        splitLineCount: splitLineStart + trailingContext,
        unifiedLineCount: unifiedLineStart + trailingContext,
    };
}

function calculateCollapsedBefore(hunks: FileDiffMetadata["hunks"], index: number) {
    const hunk = hunks[index];
    const currentStart = getHunkContextStart(hunk);
    if (index === 0) {
        return Math.max(0, currentStart - 1);
    }
    const prev = hunks[index - 1];
    const prevEnd = getHunkContextEnd(prev);
    return Math.max(0, currentStart - prevEnd);
}

function getHunkContextStart(hunk: FileDiffMetadata["hunks"][number]) {
    const starts = [hunk.additionStart, hunk.deletionStart].filter((lineNumber) => lineNumber > 0);
    return starts.length > 0 ? Math.min(...starts) : 1;
}

function getHunkContextEnd(hunk: FileDiffMetadata["hunks"][number]) {
    const ends = [
        hunk.additionStart > 0 ? hunk.additionStart + hunk.additionCount : undefined,
        hunk.deletionStart > 0 ? hunk.deletionStart + hunk.deletionCount : undefined,
    ].filter((lineNumber): lineNumber is number => typeof lineNumber === "number");
    return ends.length > 0 ? Math.min(...ends) : 1;
}

function toFullFileLineIndex(lineNumber: number) {
    return Math.max(0, lineNumber - 1);
}
