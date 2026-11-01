import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PullRequestRef } from "@/lib/git-host/types";
import { hashString } from "@/lib/review-file-fingerprint";
import { readViewedVersionIds, writeViewedVersionIds } from "@/lib/storage";

export function viewedStorageKey(prRef: PullRequestRef, diffScopeSegment: string) {
    return `${prRef.host}:${prRef.workspace}/${prRef.repo}/${prRef.pullRequestId}:${diffScopeSegment}`;
}

/** Viewed state is stored per file content fingerprint, so a changed file becomes unviewed again. */
export function useReviewViewedFiles({
    fileDiffFingerprints,
    diffNotReady,
    storageKey,
}: {
    fileDiffFingerprints: Map<string, string>;
    diffNotReady: boolean;
    storageKey: string;
}) {
    const [viewedFiles, setViewedFiles] = useState<Set<string>>(() => new Set());
    const loadedRevisionRef = useRef("");
    const skipPersistRevisionRef = useRef("");

    const versionIdByPath = useMemo(() => {
        const map = new Map<string, string>();
        for (const [path, fingerprint] of fileDiffFingerprints) map.set(path, `${path}::${fingerprint}`);
        return map;
    }, [fileDiffFingerprints]);
    const revision = useMemo(() => {
        const versionIds = Array.from(versionIdByPath.values()).sort();
        return `${storageKey}:${versionIds.length}:${hashString(versionIds.join("|"))}`;
    }, [storageKey, versionIdByPath]);

    useEffect(() => {
        if (diffNotReady || loadedRevisionRef.current === revision) return;
        loadedRevisionRef.current = revision;
        skipPersistRevisionRef.current = revision;
        const viewedIds = readViewedVersionIds(storageKey, new Set(versionIdByPath.values()));
        setViewedFiles(new Set(Array.from(versionIdByPath).flatMap(([path, versionId]) => (viewedIds.has(versionId) ? [path] : []))));
    }, [diffNotReady, revision, storageKey, versionIdByPath]);

    useEffect(() => {
        if (diffNotReady || loadedRevisionRef.current !== revision) return;
        if (skipPersistRevisionRef.current === revision) {
            skipPersistRevisionRef.current = "";
            return;
        }
        const viewedVersionIds = new Set(Array.from(viewedFiles).flatMap((path) => versionIdByPath.get(path) ?? []));
        writeViewedVersionIds(storageKey, viewedVersionIds);
    }, [diffNotReady, revision, storageKey, versionIdByPath, viewedFiles]);

    const markPathViewed = useCallback(
        (path: string) => {
            if (!versionIdByPath.has(path)) return;
            setViewedFiles((prev) => (prev.has(path) ? prev : new Set(prev).add(path)));
        },
        [versionIdByPath],
    );
    const toggleViewedForPath = useCallback(
        (path: string) => {
            if (!versionIdByPath.has(path)) return;
            setViewedFiles((prev) => {
                const next = new Set(prev);
                if (!next.delete(path)) next.add(path);
                return next;
            });
        },
        [versionIdByPath],
    );

    return { viewedFiles, setViewedFiles, versionIdByPath, markPathViewed, toggleViewedForPath };
}
