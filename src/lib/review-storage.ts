const DIRECTORY_STATE_KEY_PREFIX = "pr_review_directory_state";
const INLINE_DRAFT_STORAGE_KEY_PREFIX = "pr_review_inline_comment_draft";
const INLINE_DRAFT_STORAGE_KEY_PREFIX_LEGACY = "bitbucket_inline_comment_draft";
const INLINE_ACTIVE_DRAFT_STORAGE_KEY_PREFIX = "pr_review_inline_comment_active";
const INLINE_ACTIVE_DRAFT_STORAGE_KEY_PREFIX_LEGACY =
  "bitbucket_inline_comment_active";

export type InlineCommentDraftKey = {
  path: string;
  line: number;
  side: "additions" | "deletions";
};

function pullRequestStorageId(
  workspace: string,
  repo: string,
  pullRequestId: string,
) {
  return `${workspace}/${repo}/${pullRequestId}`;
}

export function makeDirectoryStateStorageKey(
  workspace: string,
  repo: string,
  pullRequestId: string,
) {
  return `${DIRECTORY_STATE_KEY_PREFIX}:${pullRequestStorageId(
    workspace,
    repo,
    pullRequestId,
  )}`;
}

export function makeInlineDraftStorageKey(
  workspace: string,
  repo: string,
  pullRequestId: string,
  draft: InlineCommentDraftKey,
) {
  return `${INLINE_DRAFT_STORAGE_KEY_PREFIX}:${pullRequestStorageId(
    workspace,
    repo,
    pullRequestId,
  )}:${draft.side}:${draft.line}:${encodeURIComponent(draft.path)}`;
}

export function makeInlineDraftLegacyStorageKey(
  workspace: string,
  repo: string,
  pullRequestId: string,
  draft: InlineCommentDraftKey,
) {
  return `${INLINE_DRAFT_STORAGE_KEY_PREFIX_LEGACY}:${pullRequestStorageId(
    workspace,
    repo,
    pullRequestId,
  )}:${draft.side}:${draft.line}:${encodeURIComponent(draft.path)}`;
}

export function makeInlineActiveDraftStorageKey(
  workspace: string,
  repo: string,
  pullRequestId: string,
) {
  return `${INLINE_ACTIVE_DRAFT_STORAGE_KEY_PREFIX}:${pullRequestStorageId(
    workspace,
    repo,
    pullRequestId,
  )}`;
}

export function makeInlineActiveDraftLegacyStorageKey(
  workspace: string,
  repo: string,
  pullRequestId: string,
) {
  return `${INLINE_ACTIVE_DRAFT_STORAGE_KEY_PREFIX_LEGACY}:${pullRequestStorageId(
    workspace,
    repo,
    pullRequestId,
  )}`;
}

export function parseInlineDraftStorageKey(
  key: string,
  workspace: string,
  repo: string,
  pullRequestId: string,
): InlineCommentDraftKey | null {
  const prId = pullRequestStorageId(workspace, repo, pullRequestId);
  const prefixes = [
    `${INLINE_DRAFT_STORAGE_KEY_PREFIX}:${prId}:`,
    `${INLINE_DRAFT_STORAGE_KEY_PREFIX_LEGACY}:${prId}:`,
  ];

  const prefix = prefixes.find((value) => key.startsWith(value));
  if (!prefix) return null;

  const rest = key.slice(prefix.length);
  const firstColon = rest.indexOf(":");
  const secondColon = rest.indexOf(":", firstColon + 1);
  if (firstColon < 0 || secondColon < 0) return null;

  const side = rest.slice(0, firstColon);
  if (side !== "additions" && side !== "deletions") return null;

  const line = Number(rest.slice(firstColon + 1, secondColon));
  if (!Number.isFinite(line) || line <= 0) return null;

  return {
    side,
    line,
    path: decodeURIComponent(rest.slice(secondColon + 1)),
  };
}
