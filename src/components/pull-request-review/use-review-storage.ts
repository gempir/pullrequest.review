import { useMemo } from "react";
import { readReviewViewedVersionIds, writeReviewViewedVersionIds } from "@/lib/data/query-collections";
import type { GitHost } from "@/lib/git-host/types";

const VIEWED_STORAGE_PREFIX = "review_viewed_state:v1";

export function useViewedStorageKey(data?: { host: GitHost; workspace: string; repo: string; pullRequestId: string }, diffScopeSegment = "full") {
    const host = data?.host;
    const workspace = data?.workspace;
    const repo = data?.repo;
    const pullRequestId = data?.pullRequestId;

    return useMemo(() => {
        if (!host || !workspace || !repo || !pullRequestId) return "";
        return `${VIEWED_STORAGE_PREFIX}:${host}:${workspace}/${repo}/${pullRequestId}:${diffScopeSegment}`;
    }, [diffScopeSegment, host, pullRequestId, repo, workspace]);
}

export function readViewedVersionIds(
    storageKey: string,
    {
        knownVersionIds,
    }: {
        fileDiffFingerprints?: ReadonlyMap<string, string>;
        knownVersionIds?: ReadonlySet<string>;
    } = {},
) {
    if (!storageKey) return new Set<string>();
    const viewedIds = readReviewViewedVersionIds(storageKey);
    if (!knownVersionIds) return viewedIds;
    return new Set(Array.from(viewedIds).filter((versionId) => knownVersionIds.has(versionId)));
}

export function writeViewedVersionIds(storageKey: string, viewedVersionIds: Set<string>) {
    if (!storageKey) return;
    writeReviewViewedVersionIds(storageKey, viewedVersionIds);
}
