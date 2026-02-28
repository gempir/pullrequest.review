import type { FileDiffMetadata } from "@pierre/diffs/react";
import type { InlineCommentDraft } from "@/components/pull-request-review/use-inline-comment-drafts";
import type { FileNode } from "@/lib/file-tree-context";
import type { Comment as PullRequestComment, PullRequestRef } from "@/lib/git-host/types";
import type { CommentThread } from "./review-threads";

export type CommentLineSide = "additions" | "deletions";
export type InlineCommentLineTarget = {
    lineNumber: number;
    annotationSide: CommentLineSide;
};

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

export function hashString(value: string) {
    let hash1 = 0x811c9dc5;
    let hash2 = 0x01000193;
    for (let i = 0; i < value.length; i += 1) {
        const char = value.charCodeAt(i);
        hash1 = Math.imul(hash1 ^ char, 0x01000193);
        hash2 = Math.imul(hash2 ^ (char + i), 0x01000193);
    }
    return `${(hash1 >>> 0).toString(16)}${(hash2 >>> 0).toString(16)}`;
}

export function buildReviewScopeCacheKey(prRef: PullRequestRef, scopeKey: string) {
    return `${prRef.host}:${prRef.workspace}/${prRef.repo}/${prRef.pullRequestId}:${scopeKey}`;
}

function commentSignature(comments: PullRequestComment[]) {
    return comments
        .map((comment) => {
            const path = comment.inline?.path ?? "";
            const line = comment.inline?.to ?? comment.inline?.from ?? 0;
            const updatedAt = comment.updatedAt ?? comment.createdAt ?? "";
            return `${comment.id}:${path}:${line}:${updatedAt}:${comment.parent?.id ?? 0}:${comment.deleted ? 1 : 0}`;
        })
        .join("|");
}

export function buildReviewDerivedCacheKey({ scopeCacheKey, diffText, comments }: { scopeCacheKey: string; diffText: string; comments: PullRequestComment[] }) {
    const diffHash = hashString(diffText);
    const commentsHash = hashString(commentSignature(comments));
    return `${scopeCacheKey}:${diffHash}:${commentsHash}`;
}
