import type { FileDiffMetadata } from "@pierre/diffs/react";
import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileVersionSelectOption } from "@/components/pull-request-review/file-version-select";
import { hashString } from "@/components/pull-request-review/review-page-model";
import { readViewedVersionIds, writeViewedVersionIds } from "@/components/pull-request-review/use-review-storage";
import { commitVersionId, latestVersionIdFromFingerprint, parseSingleFilePatch } from "@/features/review/model/review-page-controller-helpers";
import { getPullRequestFileHistoryCollection } from "@/lib/git-host/query-collections";
import type { GitHost, PullRequestBundle } from "@/lib/git-host/types";

type PullRequestRef = {
    host: GitHost;
    workspace: string;
    repo: string;
    pullRequestId: string;
};

type PersistedFileHistoryByPath = Record<
    string,
    {
        entries: Array<{
            versionId: string;
            commitHash: string;
            commitDate?: string;
            commitMessage?: string;
            authorDisplayName?: string;
            filePathAtCommit: string;
            status: "added" | "modified" | "removed" | "renamed";
            patch: string;
        }>;
        fetchedAt: number;
    }
>;

type UseReviewFileVersionsParams = {
    fileDiffFingerprints: Map<string, string>;
    historyRevision: string;
    persistedFileHistoryByPath: PersistedFileHistoryByPath;
    prData: Pick<PullRequestBundle, "diffstat" | "commits"> | undefined;
    prRef: PullRequestRef;
    setViewedFiles: Dispatch<SetStateAction<Set<string>>>;
    viewedFiles: Set<string>;
    viewedStorageKey: string | null | undefined;
};

export function useReviewFileVersions({
    fileDiffFingerprints,
    historyRevision,
    persistedFileHistoryByPath,
    prData,
    prRef,
    setViewedFiles,
    viewedFiles,
    viewedStorageKey,
}: UseReviewFileVersionsParams) {
    const [selectedVersionIdByPath, setSelectedVersionIdByPath] = useState<Record<string, string>>({});
    const [historyRequestedPaths, setHistoryRequestedPaths] = useState<Set<string>>(new Set());
    const [historyLoadingByPath, setHistoryLoadingByPath] = useState<Record<string, boolean>>({});
    const [historyErrorByPath, setHistoryErrorByPath] = useState<Record<string, string | null>>({});
    const loadedViewedStateRevisionRef = useRef("");
    const skipViewedStatePersistRevisionRef = useRef("");
    const loadedHistoryRevisionRef = useRef("");

    const latestVersionIdByPath = useMemo(() => {
        const map = new Map<string, string>();
        for (const [path, fingerprint] of fileDiffFingerprints.entries()) {
            map.set(path, latestVersionIdFromFingerprint(path, fingerprint));
        }
        return map;
    }, [fileDiffFingerprints]);
    const viewedStateLoadRevision = useMemo(() => {
        if (!viewedStorageKey) return "";
        const sortedVersionIds = Array.from(latestVersionIdByPath.values()).sort();
        return `${viewedStorageKey}:${sortedVersionIds.length}:${hashString(sortedVersionIds.join("|"))}`;
    }, [latestVersionIdByPath, viewedStorageKey]);
    const resetHistoryTracking = useCallback(() => {
        setHistoryRequestedPaths(new Set());
        setHistoryLoadingByPath({});
        setHistoryErrorByPath({});
    }, []);

    useEffect(() => {
        if (!viewedStorageKey || typeof window === "undefined") return;
        if (prData?.diffstat.length && latestVersionIdByPath.size === 0) return;
        if (loadedViewedStateRevisionRef.current === viewedStateLoadRevision) return;
        loadedViewedStateRevisionRef.current = viewedStateLoadRevision;
        skipViewedStatePersistRevisionRef.current = viewedStateLoadRevision;
        const knownVersionIds = new Set(latestVersionIdByPath.values());
        const viewedIds = readViewedVersionIds(viewedStorageKey, {
            fileDiffFingerprints,
            knownVersionIds,
        });
        const nextViewedFiles = new Set<string>();
        for (const [path, versionId] of latestVersionIdByPath.entries()) {
            if (viewedIds.has(versionId)) {
                nextViewedFiles.add(path);
            }
        }
        setViewedFiles(nextViewedFiles);
        resetHistoryTracking();
    }, [fileDiffFingerprints, latestVersionIdByPath, prData?.diffstat.length, resetHistoryTracking, setViewedFiles, viewedStateLoadRevision, viewedStorageKey]);

    useEffect(() => {
        if (loadedHistoryRevisionRef.current === historyRevision) return;
        loadedHistoryRevisionRef.current = historyRevision;
        resetHistoryTracking();
    }, [historyRevision, resetHistoryTracking]);

    useEffect(() => {
        if (!viewedStorageKey || typeof window === "undefined") return;
        if (prData?.diffstat.length && latestVersionIdByPath.size === 0) return;
        if (loadedViewedStateRevisionRef.current !== viewedStateLoadRevision) return;
        if (skipViewedStatePersistRevisionRef.current === viewedStateLoadRevision) {
            skipViewedStatePersistRevisionRef.current = "";
            return;
        }
        const viewedVersionIds = new Set<string>();
        for (const viewedPath of viewedFiles) {
            const latestVersionId = latestVersionIdByPath.get(viewedPath);
            if (!latestVersionId) continue;
            viewedVersionIds.add(latestVersionId);
        }
        writeViewedVersionIds(viewedStorageKey, viewedVersionIds);
    }, [latestVersionIdByPath, prData?.diffstat.length, viewedFiles, viewedStateLoadRevision, viewedStorageKey]);

    useEffect(() => {
        setSelectedVersionIdByPath((prev) => {
            const next: Record<string, string> = {};
            let changed = false;
            for (const [path, latestVersionId] of latestVersionIdByPath.entries()) {
                next[path] = latestVersionId;
                if (prev[path] !== latestVersionId) {
                    changed = true;
                }
            }
            if (!changed && Object.keys(prev).length === Object.keys(next).length) return prev;
            return next;
        });
    }, [latestVersionIdByPath]);

    const fetchRemoteFileHistory = useCallback(
        async (path: string) => {
            if (!prData) return;
            const normalizedPath = path.trim();
            if (!normalizedPath) return;
            setHistoryRequestedPaths((prev) => {
                if (prev.has(normalizedPath)) return prev;
                const next = new Set(prev);
                next.add(normalizedPath);
                return next;
            });
            setHistoryLoadingByPath((prev) => ({ ...prev, [normalizedPath]: true }));
            setHistoryErrorByPath((prev) => ({ ...prev, [normalizedPath]: null }));
            try {
                const scopedHistory = getPullRequestFileHistoryCollection({
                    prRef,
                    path: normalizedPath,
                    commits: prData.commits ?? [],
                    limit: 20,
                });
                await scopedHistory.utils.refetch({ throwOnError: false });
                const maybeError = scopedHistory.utils.lastError;
                setHistoryErrorByPath((prev) => ({
                    ...prev,
                    [normalizedPath]: maybeError instanceof Error ? maybeError.message : null,
                }));
            } finally {
                setHistoryLoadingByPath((prev) => ({ ...prev, [normalizedPath]: false }));
            }
        },
        [prData, prRef],
    );

    const getSelectedVersionIdForPath = useCallback(
        (path: string) => selectedVersionIdByPath[path] ?? latestVersionIdByPath.get(path),
        [latestVersionIdByPath, selectedVersionIdByPath],
    );
    const markPathViewed = useCallback(
        (path: string) => {
            if (!latestVersionIdByPath.has(path)) return;
            setViewedFiles((prev) => {
                if (prev.has(path)) return prev;
                const next = new Set(prev);
                next.add(path);
                return next;
            });
        },
        [latestVersionIdByPath, setViewedFiles],
    );
    const toggleViewedForPath = useCallback(
        (path: string) => {
            if (!latestVersionIdByPath.has(path)) return;
            setViewedFiles((prev) => {
                const next = new Set(prev);
                if (next.has(path)) {
                    next.delete(path);
                } else {
                    next.add(path);
                }
                return next;
            });
        },
        [latestVersionIdByPath, setViewedFiles],
    );
    const isPathViewed = useCallback((path: string) => viewedFiles.has(path), [viewedFiles]);
    const isVersionViewed = useCallback(
        (versionId: string) => {
            if (!versionId.includes("::")) return true;
            const path = versionId.split("::")[0];
            return path ? viewedFiles.has(path) : true;
        },
        [viewedFiles],
    );
    const setSelectedVersionForPath = useCallback((path: string, versionId: string) => {
        setSelectedVersionIdByPath((prev) => (prev[path] === versionId ? prev : { ...prev, [path]: versionId }));
    }, []);
    const handleOpenVersionMenuForPath = useCallback(
        (path: string) => {
            if (historyRequestedPaths.has(path)) return;
            void fetchRemoteFileHistory(path);
        },
        [fetchRemoteFileHistory, historyRequestedPaths],
    );
    const getVersionOptionsForPath = useCallback(
        (path: string) => {
            const options: FileVersionSelectOption[] = [];
            const latestVersionId = latestVersionIdByPath.get(path);
            const remote = persistedFileHistoryByPath[path];
            if (latestVersionId) {
                options.push({
                    id: latestVersionId,
                    label: "Latest",
                    unread: !viewedFiles.has(path),
                    latest: true,
                });
            }
            if (!remote) return options;
            const historicalEntries = [...remote.entries].sort((a, b) => {
                const timeA = a.commitDate ? Date.parse(a.commitDate) : Number.NaN;
                const timeB = b.commitDate ? Date.parse(b.commitDate) : Number.NaN;
                if (Number.isNaN(timeA) && Number.isNaN(timeB)) return 0;
                if (Number.isNaN(timeA)) return 1;
                if (Number.isNaN(timeB)) return -1;
                return timeB - timeA;
            });
            for (const entry of historicalEntries) {
                options.push({
                    id: commitVersionId(path, entry.commitHash),
                    label: entry.commitHash.slice(0, 8),
                    unread: false,
                    latest: false,
                    commitMessage: entry.commitMessage?.split("\n")[0]?.trim() || undefined,
                    commitDate: entry.commitDate,
                });
            }
            if (historyLoadingByPath[path]) {
                options.push({ id: `${path}:loading`, label: "Loading history...", unread: false, latest: false, state: "loading" });
            }
            if (historyErrorByPath[path]) {
                options.push({ id: `${path}:error`, label: "Failed to load", unread: false, latest: false, state: "error" });
            }
            return options;
        },
        [historyErrorByPath, historyLoadingByPath, latestVersionIdByPath, persistedFileHistoryByPath, viewedFiles],
    );
    const resolveDisplayedDiffForPath = useCallback(
        (path: string, latestFileDiff: FileDiffMetadata | undefined) => {
            if (!latestFileDiff) {
                return { fileDiff: undefined, readOnlyHistorical: false, selectedVersionId: undefined };
            }
            const selectedVersionId = getSelectedVersionIdForPath(path);
            const latestVersionId = latestVersionIdByPath.get(path);
            if (!selectedVersionId || !latestVersionId || selectedVersionId === latestVersionId) {
                return {
                    fileDiff: latestFileDiff,
                    readOnlyHistorical: false,
                    selectedVersionId: latestVersionId ?? selectedVersionId,
                };
            }
            if (selectedVersionId.endsWith(":loading") || selectedVersionId.endsWith(":error")) {
                return { fileDiff: latestFileDiff, readOnlyHistorical: false, selectedVersionId: latestVersionId };
            }
            const commitHash = selectedVersionId.slice(path.length + 1);
            const entry = persistedFileHistoryByPath[path]?.entries.find((item) => item.commitHash === commitHash);
            const parsed = entry ? parseSingleFilePatch(entry.patch) : undefined;
            if (!parsed) {
                return { fileDiff: latestFileDiff, readOnlyHistorical: false, selectedVersionId: latestVersionId };
            }
            return { fileDiff: parsed, readOnlyHistorical: true, selectedVersionId };
        },
        [getSelectedVersionIdForPath, latestVersionIdByPath, persistedFileHistoryByPath],
    );

    return {
        fetchRemoteFileHistory,
        getSelectedVersionIdForPath,
        getVersionOptionsForPath,
        handleOpenVersionMenuForPath,
        historyRequestedPaths,
        isPathViewed,
        isVersionViewed,
        latestVersionIdByPath,
        markPathViewed,
        resolveDisplayedDiffForPath,
        setSelectedVersionForPath,
        setViewedFiles,
        toggleViewedForPath,
        viewedFiles,
    };
}
