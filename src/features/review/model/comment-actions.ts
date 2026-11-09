import type { Comment } from "@/lib/git-host/types";

/** Everything a rendered comment thread can do, bundled so views pass one prop instead of a dozen. */
export interface CommentActions {
    currentUserDisplayName?: string;
    canReply: boolean;
    canResolve: boolean;
    /** Replies can target any comment; otherwise they attach to the thread root. */
    nestedReplies: boolean;
    pending: { create: boolean; resolve: boolean; update: boolean; remove: boolean };
    reply: (parentId: number, content: string) => Promise<unknown> | undefined;
    edit: (comment: Comment, content: string) => Promise<unknown> | undefined;
    remove: (comment: Comment) => Promise<unknown> | undefined;
    resolve: (comment: Comment, resolve: boolean) => void;
}

function normalizeName(value?: string) {
    return value?.trim().toLowerCase() ?? "";
}

export function isOwnComment(actions: Pick<CommentActions, "currentUserDisplayName">, comment: Comment) {
    const currentUser = normalizeName(actions.currentUserDisplayName);
    return Boolean(currentUser) && normalizeName(comment.user?.displayName) === currentUser;
}
