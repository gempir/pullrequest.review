import type { DiffLineAnnotation, FileDiffOptions } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import type { CommentThread } from "@/features/review/model/review-threads";
import { orderFileTreePaths } from "@/lib/file-tree-order";
import type { CommentSide } from "@/lib/git-host/types";
import type { InlineDraftLocation } from "@/lib/storage";

export type InlineCommentLineTarget = {
    lineNumber: number;
    annotationSide: CommentSide;
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

export type ReviewSidebarThreadItem = {
    commentId: number;
    isResolved: boolean;
    path: string;
    line?: number;
    side?: CommentSide;
    replyCount: number;
    latestActivityAt?: string;
    thread: CommentThread;
};

export type ReviewFileDiffOptions = FileDiffOptions<SingleFileAnnotationMetadata | undefined, undefined>;

export function sameDraftLocation(a: InlineDraftLocation | null, b: InlineDraftLocation) {
    return a?.path === b.path && a.line === b.line && a.side === b.side;
}

export function draftLocationKey(draft: InlineDraftLocation) {
    return `${draft.side}:${draft.line}:${draft.path}`;
}
