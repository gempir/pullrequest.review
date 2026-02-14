import { makeVersionedStorageKey } from "@/lib/storage/versioned-local-storage";

export type InlineDraftSide = "additions" | "deletions";

export type InlineDraftLocation = {
  path: string;
  line: number;
  side: InlineDraftSide;
};

const INLINE_DRAFT_PREFIX_BASE = "pr_review_inline_comment_draft";
const INLINE_DRAFT_PREFIX = makeVersionedStorageKey(
  INLINE_DRAFT_PREFIX_BASE,
  2,
);

const INLINE_ACTIVE_PREFIX_BASE = "pr_review_inline_comment_active";
const INLINE_ACTIVE_PREFIX = makeVersionedStorageKey(
  INLINE_ACTIVE_PREFIX_BASE,
  2,
);

export function inlineDraftStorageKey(
  workspace: string,
  repo: string,
  pullRequestId: string,
  draft: InlineDraftLocation,
) {
  return `${INLINE_DRAFT_PREFIX}:${workspace}/${repo}/${pullRequestId}:${draft.side}:${draft.line}:${encodeURIComponent(draft.path)}`;
}

export function inlineActiveDraftStorageKey(
  workspace: string,
  repo: string,
  pullRequestId: string,
) {
  return `${INLINE_ACTIVE_PREFIX}:${workspace}/${repo}/${pullRequestId}`;
}

export function parseInlineDraftStorageKey(
  key: string,
  workspace: string,
  repo: string,
  pullRequestId: string,
): InlineDraftLocation | null {
  const prefix = `${INLINE_DRAFT_PREFIX}:${workspace}/${repo}/${pullRequestId}:`;
  if (!key.startsWith(prefix)) return null;

  const rest = key.slice(prefix.length);
  const firstColon = rest.indexOf(":");
  const secondColon = rest.indexOf(":", firstColon + 1);
  if (firstColon < 0 || secondColon < 0) return null;

  const side = rest.slice(0, firstColon);
  if (side !== "additions" && side !== "deletions") return null;

  const line = Number(rest.slice(firstColon + 1, secondColon));
  if (!Number.isFinite(line) || line <= 0) return null;

  const encodedPath = rest.slice(secondColon + 1);
  try {
    return { side, line, path: decodeURIComponent(encodedPath) };
  } catch {
    return null;
  }
}
