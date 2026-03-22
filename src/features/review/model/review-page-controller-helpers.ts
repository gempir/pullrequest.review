import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { hashString } from "@/components/pull-request-review/review-page-model";
import type { Comment as PullRequestComment } from "@/lib/git-host/types";
import type { ReviewDiffScopeSearch } from "@/lib/review-diff-scope";

export type FullFileContextEntry =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "ready"; oldLines: string[]; newLines: string[]; fetchedAt: number };

export type CreateCommentPayload = {
    path?: string;
    content: string;
    line?: number;
    side?: "additions" | "deletions";
    parentId?: number;
};

export const ALL_MODE_SCROLL_RETRY_DELAYS = [0, 80, 180, 320, 500, 700, 950, 1200, 1500, 1850, 2200, 2600, 3000, 3400, 3800] as const;
export const ALL_MODE_STICKY_OFFSET = 0;

const singlePatchParseCache = new Map<string, FileDiffMetadata | undefined>();

export function splitFileIntoLines(contents: string) {
    if (!contents) return [];
    const normalized = contents.replace(/\r\n/g, "\n");
    const lines: string[] = [];
    let start = 0;
    for (let i = 0; i < normalized.length; i += 1) {
        if (normalized[i] === "\n") {
            lines.push(normalized.slice(start, i + 1));
            start = i + 1;
        }
    }
    if (start < normalized.length) {
        lines.push(normalized.slice(start));
    }
    return lines;
}

export function latestVersionIdFromFingerprint(path: string, fingerprint: string) {
    return `${path}::${fingerprint}`;
}

export function commitVersionId(path: string, commitHash: string) {
    return `${path}:${commitHash}`;
}

export function parseSingleFilePatch(patch: string) {
    if (!patch) return undefined;
    const cacheKey = hashString(patch);
    if (singlePatchParseCache.has(cacheKey)) {
        return singlePatchParseCache.get(cacheKey);
    }
    const parsed = parsePatchFiles(patch);
    const firstPatch = parsed[0];
    const firstFile = firstPatch?.files?.[0];
    if (singlePatchParseCache.size > 300) {
        const firstKey = singlePatchParseCache.keys().next().value;
        if (firstKey) {
            singlePatchParseCache.delete(firstKey);
        }
    }
    singlePatchParseCache.set(cacheKey, firstFile);
    return firstFile;
}

export function parentDirectories(path: string): string[] {
    const parts = path.split("/").filter(Boolean);
    if (parts.length <= 1) return [];
    parts.pop();
    const directories: string[] = [];
    let current = "";
    for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        directories.push(current);
    }
    return directories;
}

export function sameScopeSearch(a: ReviewDiffScopeSearch, b: ReviewDiffScopeSearch) {
    return a.from === b.from && a.to === b.to;
}

export function commentMatchKey(comment: Pick<PullRequestComment, "content" | "inline" | "parent">) {
    const parentId = comment.parent?.id ?? 0;
    const content = comment.content?.raw?.trim() ?? "";
    if (parentId > 0) {
        return `reply:${parentId}|${content}`;
    }
    if (!comment.inline?.path) {
        return `comment:${content}`;
    }
    const line = comment.inline?.to ?? comment.inline?.from ?? 0;
    const side = comment.inline?.from ? "deletions" : "additions";
    return `inline:${comment.inline.path}|${line}|${side}|${content}`;
}
