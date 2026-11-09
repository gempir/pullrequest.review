import type { Comment as PullRequestComment } from "@/lib/git-host/types";

export interface CommentThreadNode {
    comment: PullRequestComment;
    children: CommentThreadNode[];
}

export interface CommentThread {
    id: number;
    root: CommentThreadNode;
}

function sortByCreatedAt(left: { createdAt?: string }, right: { createdAt?: string }) {
    return new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime();
}

function sortByCommentCreatedAt(left: { comment: { createdAt?: string } }, right: { comment: { createdAt?: string } }) {
    return sortByCreatedAt(left.comment, right.comment);
}

export function sortThreadsByCreatedAt<T extends { root: { comment: { createdAt?: string } } }>(threads: T[]) {
    return threads.toSorted((left, right) => sortByCommentCreatedAt(left.root, right.root));
}

function buildThreadNode(comment: PullRequestComment, childrenByParentId: Map<number, PullRequestComment[]>, visitedIds: Set<number>): CommentThreadNode {
    // Guard against malformed cyclic parent chains.
    if (visitedIds.has(comment.id)) {
        return {
            comment,
            children: [],
        };
    }

    const nextVisitedIds = new Set(visitedIds);
    nextVisitedIds.add(comment.id);
    const children = (childrenByParentId.get(comment.id) ?? [])
        .sort(sortByCreatedAt)
        .map((child) => buildThreadNode(child, childrenByParentId, nextVisitedIds));

    return {
        comment,
        children,
    };
}

export function buildCommentThreads(comments: PullRequestComment[]): CommentThread[] {
    const commentsById = new Map<number, PullRequestComment>();
    const childrenByParentId = new Map<number, PullRequestComment[]>();
    const roots: PullRequestComment[] = [];

    for (const comment of comments) {
        commentsById.set(comment.id, comment);
    }

    for (const comment of comments) {
        const parentId = comment.parent?.id;
        if (!parentId || !commentsById.has(parentId)) {
            roots.push(comment);
            continue;
        }
        const children = childrenByParentId.get(parentId) ?? [];
        children.push(comment);
        childrenByParentId.set(parentId, children);
    }

    return sortThreadsByCreatedAt(
        roots.map((root) => ({
            id: root.id,
            root: buildThreadNode(root, childrenByParentId, new Set<number>()),
        })),
    );
}

export function flattenThread(thread: CommentThread): PullRequestComment[] {
    const flattened: PullRequestComment[] = [];
    const walk = (node: CommentThreadNode) => {
        flattened.push(node.comment);
        node.children.forEach(walk);
    };
    walk(thread.root);
    return flattened;
}
