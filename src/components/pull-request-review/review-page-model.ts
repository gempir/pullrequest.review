import type { FileDiffMetadata } from "@pierre/diffs/react";
import type { InlineCommentDraft } from "@/components/pull-request-review/use-inline-comment-drafts";
import type { FileNode } from "@/lib/file-tree-context";
import type { Comment as PullRequestComment } from "@/lib/git-host/types";
import type { CommentThread } from "./review-threads";

export type CommentLineSide = "additions" | "deletions";

type ExistingThreadAnnotation = {
    kind: "thread";
    thread: CommentThread;
};

type DraftThreadAnnotation = {
    kind: "draft";
    draft: InlineCommentDraft;
};

export type SingleFileAnnotationMetadata = ExistingThreadAnnotation | DraftThreadAnnotation;

export type SingleFileAnnotation = {
    side: CommentLineSide;
    lineNumber: number;
    metadata: SingleFileAnnotationMetadata;
};

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

export function collectDirectoryPaths(nodes: FileNode[]) {
    const paths: string[] = [];
    const walk = (items: FileNode[]) => {
        for (const node of items) {
            if (node.type !== "directory") continue;
            paths.push(node.path);
            if (node.children?.length) walk(node.children);
        }
    };
    walk(nodes);
    return paths;
}
