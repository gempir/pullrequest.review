export type InlineDraftSide = "additions" | "deletions";

export type InlineDraftLocation = {
    path: string;
    line: number;
    side: InlineDraftSide;
};

const INLINE_DRAFT_PREFIX = "inline_comment_draft:v1";

export function inlineDraftStorageKey(workspace: string, repo: string, pullRequestId: string, draft: InlineDraftLocation) {
    return `${INLINE_DRAFT_PREFIX}:${workspace}/${repo}/${pullRequestId}:${draft.side}:${draft.line}:${encodeURIComponent(draft.path)}`;
}
