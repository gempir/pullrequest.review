import type { DiffLineAnnotation } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import type { CommentThread } from "@/features/review/model/review-threads";
import { orderFileTreePaths } from "@/lib/file-tree-order";
import type { Comment as PullRequestComment } from "@/lib/git-host/types";
import type { InlineDraftLocation } from "@/lib/storage";

export type CommentLineSide = "additions" | "deletions";
export type InlineCommentLineTarget = {
    lineNumber: number;
    annotationSide: CommentLineSide;
};

type ExistingThreadAnnotation = {
    kind: "thread";
    thread: CommentThread;
    suggestionSourceFileDiff?: FileDiffMetadata;
};

type DraftThreadAnnotation = {
    kind: "draft";
    draft: InlineDraftLocation;
};

export type SingleFileAnnotationMetadata = ExistingThreadAnnotation | DraftThreadAnnotation;

export type SingleFileAnnotation = DiffLineAnnotation<ExistingThreadAnnotation> | DiffLineAnnotation<DraftThreadAnnotation>;

export function getCommentPath(comment: PullRequestComment) {
    return comment.inline?.path ?? "";
}

export function getCommentInlinePosition(comment: PullRequestComment) {
    const from = comment.inline?.from;
    const to = comment.inline?.to;
    const lineNumber = to ?? from;
    if (!lineNumber) return null;
    const side: CommentLineSide = to ? "additions" : "deletions";
    return { side, lineNumber };
}

export function getFilePath(fileDiff: FileDiffMetadata, index: number) {
    return fileDiff.name ?? fileDiff.prevName ?? String(index);
}

export function createOmnibarFilePaths(filePaths: readonly string[], fallbackPaths: readonly string[]) {
    const sourcePaths = filePaths.length > 0 ? filePaths : fallbackPaths;
    const seen = new Set<string>();
    const uniquePaths: string[] = [];
    for (const path of sourcePaths) {
        if (seen.has(path)) continue;
        seen.add(path);
        uniquePaths.push(path);
    }
    return orderFileTreePaths(uniquePaths);
}
