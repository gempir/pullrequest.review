import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PR_SUMMARY_PATH } from "@/features/review/model/pr-summary";
import type { PullRequestRef } from "@/lib/git-host/types";
import { readViewedVersionIds, writeViewedVersionIds } from "@/lib/storage";

export function viewedStorageKey(prRef: PullRequestRef, diffScopeSegment: string) {
    return `${prRef.host}:${prRef.workspace}/${prRef.repo}/${prRef.pullRequestId}:${diffScopeSegment}`;
}

/** Viewed state is stored per file content fingerprint, so a changed file becomes unviewed again. */
export function useReviewViewedFiles({ fileDiffFingerprints, storageKey }: { fileDiffFingerprints: Map<string, string>; storageKey: string }) {
    const [stored, setStored] = useState(() => ({ storageKey, versionIds: readViewedVersionIds(storageKey) }));
    if (stored.storageKey !== storageKey) setStored({ storageKey, versionIds: readViewedVersionIds(storageKey) });

    const versionIdByPath = useMemo(() => {
        const map = new Map<string, string>();
        for (const [path, fingerprint] of fileDiffFingerprints) map.set(path, `${path}::${fingerprint}`);
        return map;
    }, [fileDiffFingerprints]);
    const viewedFiles = useMemo(
        () => new Set(Array.from(versionIdByPath).flatMap(([path, versionId]) => (stored.versionIds.has(versionId) ? [path] : []))),
        [stored.versionIds, versionIdByPath],
    );

    /** Marks `paths` viewed or unviewed; ids of versions no longer in the diff are dropped. */
    const setViewed = useCallback(
        (paths: string[], viewed: (path: string, wasViewed: boolean) => boolean) => {
            if (!paths.some((path) => versionIdByPath.has(path))) return;
            const changing = new Set(paths);
            setStored((prev) => {
                const next = new Set<string>();
                for (const [path, versionId] of versionIdByPath) {
                    const wasViewed = prev.versionIds.has(versionId);
                    if (changing.has(path) ? viewed(path, wasViewed) : wasViewed) next.add(versionId);
                }
                writeViewedVersionIds(storageKey, next);
                return { storageKey, versionIds: next };
            });
        },
        [storageKey, versionIdByPath],
    );

    const markPathViewed = useCallback((path: string) => setViewed([path], () => true), [setViewed]);
    const toggleViewedForPath = useCallback((path: string) => setViewed([path], (_, wasViewed) => !wasViewed), [setViewed]);

    return { viewedFiles, versionIdByPath, setViewed, markPathViewed, toggleViewedForPath };
}

/** In single-file mode, opening a file marks that version viewed once. */
export function useAutoMarkActiveFileViewed({
    viewMode,
    autoMarkViewedFiles,
    showSettingsPanel,
    activeFile,
    visiblePathSet,
    versionIdByPath,
    markPathViewed,
}: {
    viewMode: "single" | "all";
    autoMarkViewedFiles: boolean;
    showSettingsPanel: boolean;
    activeFile: string | undefined;
    visiblePathSet: Set<string>;
    versionIdByPath: Map<string, string>;
    markPathViewed: (path: string) => void;
}) {
    const autoMarkedVersionIdsRef = useRef(new Set<string>());
    useEffect(() => {
        if (!autoMarkViewedFiles) return;
        if (viewMode !== "single") return;
        if (showSettingsPanel) return;
        if (!activeFile || !visiblePathSet.has(activeFile)) return;
        if (activeFile === PR_SUMMARY_PATH) return;
        const selectedVersionId = versionIdByPath.get(activeFile);
        if (!selectedVersionId) return;
        if (autoMarkedVersionIdsRef.current.has(selectedVersionId)) return;

        autoMarkedVersionIdsRef.current.add(selectedVersionId);
        markPathViewed(activeFile);
    }, [activeFile, autoMarkViewedFiles, markPathViewed, showSettingsPanel, versionIdByPath, viewMode, visiblePathSet]);
}
