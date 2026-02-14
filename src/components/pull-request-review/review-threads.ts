import type { Comment as PullRequestComment } from "@/lib/git-host/types";

export interface CommentThread {
    id: number;
    root: PullRequestComment;
    replies: PullRequestComment[];
}

function sortByCreatedAt(left: { createdAt?: string }, right: { createdAt?: string }) {
    return new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime();
}

export function sortThreadsByCreatedAt<T extends { root: { createdAt?: string } }>(threads: T[]) {
    // Return a new array so caller-owned collections are never mutated by sorting.
    return [...threads].sort((left, right) => sortByCreatedAt(left.root, right.root));
}

export function buildCommentThreads(comments: PullRequestComment[]): CommentThread[] {
    const roots = comments.filter((comment) => !comment.parent?.id);
    const repliesByParent = new Map<number, PullRequestComment[]>();

    for (const comment of comments) {
        const parentId = comment.parent?.id;
        if (!parentId) continue;
        const replies = repliesByParent.get(parentId) ?? [];
        replies.push(comment);
        repliesByParent.set(parentId, replies);
    }

    return sortThreadsByCreatedAt(
        roots.map((root) => ({
            id: root.id,
            root,
            replies: [...(repliesByParent.get(root.id) ?? [])].sort(sortByCreatedAt),
        })),
    );
}
