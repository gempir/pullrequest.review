import type { Comment as PullRequestComment } from "@/lib/git-host/types";

export interface CommentThreadNode {
    comment: PullRequestComment;
    children: CommentThreadNode[];
}

export interface CommentThread {
    id: number;
    root: CommentThreadNode;
}

type LegacyCommentThread = {
    id: number;
    root: PullRequestComment;
    replies?: PullRequestComment[];
};

function sortByCreatedAt(left: { createdAt?: string }, right: { createdAt?: string }) {
    return new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime();
}

function sortByCommentCreatedAt(left: { comment: { createdAt?: string } }, right: { comment: { createdAt?: string } }) {
    return sortByCreatedAt(left.comment, right.comment);
}

export function sortThreadsByCreatedAt<T extends { root: { comment: { createdAt?: string } } }>(threads: T[]) {
    // Return a new array so caller-owned collections are never mutated by sorting.
    return [...threads].sort((left, right) => sortByCommentCreatedAt(left.root, right.root));
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

export function threadCommentCount(thread: CommentThread) {
    const countNode = (node: CommentThreadNode): number => 1 + node.children.reduce((sum, child) => sum + countNode(child), 0);
    return countNode(thread.root);
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

function isThreadNode(value: unknown): value is CommentThreadNode {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<CommentThreadNode>;
    return Boolean(candidate.comment && Array.isArray(candidate.children));
}

function normalizeLegacyThread(thread: LegacyCommentThread): CommentThread | null {
    if (!thread.root || typeof thread.root !== "object") return null;
    return {
        id: Number(thread.id || thread.root.id),
        root: {
            comment: thread.root,
            children: (thread.replies ?? []).sort(sortByCreatedAt).map((reply) => ({
                comment: reply,
                children: [],
            })),
        },
    };
}

export function normalizeCommentThread(value: unknown): CommentThread | null {
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<CommentThread> & Partial<LegacyCommentThread>;

    if (isThreadNode(candidate.root)) {
        return {
            id: Number(candidate.id ?? candidate.root.comment.id),
            root: candidate.root,
        };
    }

    if (candidate.root && typeof candidate.root === "object") {
        return normalizeLegacyThread(candidate as LegacyCommentThread);
    }

    return null;
}

export function normalizeCommentThreads(threads: unknown[]): CommentThread[] {
    const normalized: CommentThread[] = [];
    for (const thread of threads) {
        const candidate = normalizeCommentThread(thread);
        if (!candidate) continue;
        normalized.push(candidate);
    }
    return normalized;
}
