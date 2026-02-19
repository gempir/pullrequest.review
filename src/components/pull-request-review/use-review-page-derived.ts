import { type FileDiffOptions, getFiletypeFromFileName, type OnDiffLineClickProps, type OnDiffLineEnterLeaveProps, parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatNavbarDate, linesUpdated, normalizeNavbarState } from "@/components/pull-request-review/review-formatters";
import { useDiffHighlighterState } from "@/components/pull-request-review/use-review-page-effects";
import { readReviewDerivedCacheValue, writeReviewDerivedCacheValue } from "@/lib/data/query-collections";
import type { FileNode } from "@/lib/file-tree-context";
import type { PullRequestBundle, PullRequestDetails } from "@/lib/git-host/types";
import { PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { useReviewComputeWorker } from "@/lib/review-performance/review-compute-worker-context";
import {
    buildReviewDerivedCacheKey,
    buildReviewScopeCacheKey,
    collectDirectoryPaths,
    getCommentInlinePosition,
    getCommentPath,
    getFilePath,
    hashString,
    type SingleFileAnnotation,
} from "./review-page-model";
import type { CommentThread } from "./review-threads";
import { sortThreadsByCreatedAt } from "./review-threads";
import type { InlineCommentDraft } from "./use-inline-comment-drafts";

type CachedReviewDerivedArtifacts = {
    fileDiffs: FileDiffMetadata[];
    fileDiffFingerprints: Array<[string, string]>;
    threads: CommentThread[];
};

type WorkerDerivedState = {
    cacheKey: string;
    fileDiffs: FileDiffMetadata[];
    fileDiffFingerprints: Map<string, string>;
    threads: CommentThread[];
};

const EMPTY_COMMENTS: PullRequestBundle["comments"] = [];

function buildFileDiffFingerprint(fileDiff: FileDiffMetadata) {
    const normalized = {
        type: fileDiff.type,
        name: fileDiff.name,
        prevName: fileDiff.prevName ?? "",
        hunks: (fileDiff.hunks ?? []).map((hunk) => ({
            additionCount: hunk.additionCount,
            additionLines: hunk.additionLines,
            additionStart: hunk.additionStart,
            deletionCount: hunk.deletionCount,
            deletionLines: hunk.deletionLines,
            deletionStart: hunk.deletionStart,
            unifiedLineCount: hunk.unifiedLineCount,
            unifiedLineStart: hunk.unifiedLineStart,
            splitLineCount: hunk.splitLineCount,
            splitLineStart: hunk.splitLineStart,
            hunkContext: hunk.hunkContext,
            hunkSpecs: hunk.hunkSpecs,
            hunkContent: hunk.hunkContent,
        })),
    };
    return hashString(JSON.stringify(normalized));
}

export function useReviewPageDerived({
    prData,
    pullRequest,
    activeFile,
    showUnviewedOnly,
    searchQuery,
    showSettingsPanel,
    viewedFiles,
    root,
    allFiles,
    settingsTreeItems,
    inlineComment,
    theme,
    compactDiffOptions,
    onOpenInlineCommentDraft,
    fullFileContexts,
}: {
    prData: PullRequestBundle | undefined;
    pullRequest: PullRequestDetails | undefined;
    activeFile: string | undefined;
    showUnviewedOnly: boolean;
    searchQuery: string;
    showSettingsPanel: boolean;
    viewedFiles: Set<string>;
    root: FileNode[];
    allFiles: () => Array<{ path: string }>;
    settingsTreeItems: Array<{ path: string }>;
    inlineComment: InlineCommentDraft | null;
    theme: Parameters<typeof useDiffHighlighterState>[0]["theme"];
    compactDiffOptions: FileDiffOptions<undefined>;
    onOpenInlineCommentDraft: (path: string, props: OnDiffLineClickProps) => void;
    fullFileContexts: Record<string, { oldLines: string[]; newLines: string[] }>;
}) {
    const diffText = prData?.diff ?? "";
    const comments = prData?.comments ?? EMPTY_COMMENTS;
    const { computeReviewDerived } = useReviewComputeWorker();
    const [workerDerived, setWorkerDerived] = useState<WorkerDerivedState>({
        cacheKey: "",
        fileDiffs: [],
        fileDiffFingerprints: new Map(),
        threads: [],
    });
    const pendingDerivedCacheKeyRef = useRef<string | null>(null);

    const applyWorkerDerived = useCallback((cacheKey: string, next: Omit<WorkerDerivedState, "cacheKey">) => {
        pendingDerivedCacheKeyRef.current = null;
        setWorkerDerived((prev) => {
            if (prev.cacheKey === cacheKey) return prev;
            return {
                cacheKey,
                ...next,
            };
        });
    }, []);

    const scopeCacheKey = useMemo(() => {
        if (!prData?.prRef) return "review:empty";
        return buildReviewScopeCacheKey(prData.prRef, "review-derived");
    }, [prData?.prRef]);

    const derivedCacheKey = useMemo(
        () =>
            buildReviewDerivedCacheKey({
                scopeCacheKey,
                diffText,
                comments,
            }),
        [comments, diffText, scopeCacheKey],
    );

    useEffect(() => {
        let cancelled = false;

        if (workerDerived.cacheKey === derivedCacheKey) {
            return;
        }

        if (!diffText && comments.length === 0) {
            applyWorkerDerived(derivedCacheKey, {
                fileDiffs: [],
                fileDiffFingerprints: new Map(),
                threads: [],
            });
            return;
        }

        const cachedArtifacts = readReviewDerivedCacheValue<CachedReviewDerivedArtifacts>(derivedCacheKey);
        if (cachedArtifacts) {
            applyWorkerDerived(derivedCacheKey, {
                fileDiffs: cachedArtifacts.fileDiffs,
                fileDiffFingerprints: new Map(cachedArtifacts.fileDiffFingerprints),
                threads: cachedArtifacts.threads,
            });
            return;
        }

        if (pendingDerivedCacheKeyRef.current === derivedCacheKey) {
            return;
        }
        pendingDerivedCacheKeyRef.current = derivedCacheKey;

        void computeReviewDerived({
            cacheKey: derivedCacheKey,
            diffText,
            comments,
        })
            .then((result) => {
                if (cancelled) return;
                if (pendingDerivedCacheKeyRef.current !== derivedCacheKey) return;
                writeReviewDerivedCacheValue(derivedCacheKey, {
                    fileDiffs: result.fileDiffs,
                    fileDiffFingerprints: Array.from(result.fileDiffFingerprints.entries()),
                    threads: result.threads,
                } satisfies CachedReviewDerivedArtifacts);
                applyWorkerDerived(derivedCacheKey, {
                    fileDiffs: result.fileDiffs,
                    fileDiffFingerprints: result.fileDiffFingerprints,
                    threads: result.threads,
                });
            })
            .catch(() => {
                if (cancelled) return;
                if (pendingDerivedCacheKeyRef.current !== derivedCacheKey) return;
                // Keep UI responsive if the compute worker fails unexpectedly.
                const parsedPatches = diffText ? parsePatchFiles(diffText) : [];
                const fallbackDiffs = parsedPatches.flatMap((patch) => patch.files);
                const fallbackFingerprints = new Map<string, string>();
                fallbackDiffs.forEach((fileDiff, index) => {
                    const path = getFilePath(fileDiff, index);
                    if (!fallbackFingerprints.has(path)) {
                        fallbackFingerprints.set(path, buildFileDiffFingerprint(fileDiff));
                    }
                });
                const roots = comments.filter((comment) => !comment.parent?.id);
                const repliesByParent = new Map<number, typeof comments>();
                for (const comment of comments) {
                    const parentId = comment.parent?.id;
                    if (!parentId) continue;
                    const replies = repliesByParent.get(parentId) ?? [];
                    replies.push(comment);
                    repliesByParent.set(parentId, replies);
                }
                const fallbackThreads: CommentThread[] = roots
                    .map((root) => ({
                        id: root.id,
                        root,
                        replies: [...(repliesByParent.get(root.id) ?? [])].sort(
                            (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
                        ),
                    }))
                    .sort((a, b) => new Date(a.root.createdAt ?? 0).getTime() - new Date(b.root.createdAt ?? 0).getTime());
                writeReviewDerivedCacheValue(derivedCacheKey, {
                    fileDiffs: fallbackDiffs,
                    fileDiffFingerprints: Array.from(fallbackFingerprints.entries()),
                    threads: fallbackThreads,
                } satisfies CachedReviewDerivedArtifacts);
                applyWorkerDerived(derivedCacheKey, {
                    fileDiffs: fallbackDiffs,
                    fileDiffFingerprints: fallbackFingerprints,
                    threads: fallbackThreads,
                });
            });

        return () => {
            cancelled = true;
        };
    }, [applyWorkerDerived, comments, computeReviewDerived, derivedCacheKey, diffText, workerDerived.cacheKey]);

    const rawFileDiffs = workerDerived.fileDiffs;

    const fileDiffs = useMemo(() => {
        if (!rawFileDiffs.length) return rawFileDiffs;
        if (Object.keys(fullFileContexts).length === 0) return rawFileDiffs;
        return rawFileDiffs.map((fileDiff, index) => {
            const path = getFilePath(fileDiff, index);
            const context = fullFileContexts[path];
            if (!context) return fileDiff;
            return applyFullContext(fileDiff, context);
        });
    }, [rawFileDiffs, fullFileContexts]);

    const preloadLanguages = useMemo(() => {
        const langs = new Set<string>(["text", "javascript"]);
        fileDiffs.forEach((fileDiff) => {
            if (fileDiff.lang) langs.add(fileDiff.lang);
            langs.add(getFiletypeFromFileName(fileDiff.name));
            if (fileDiff.prevName) langs.add(getFiletypeFromFileName(fileDiff.prevName));
        });
        return [...langs];
    }, [fileDiffs]);

    const { diffHighlighterReady, diffPlainTextFallback } = useDiffHighlighterState({
        fileDiffs,
        theme,
        preloadLanguages,
    });

    const toRenderableFileDiff = useCallback(
        (fileDiff: FileDiffMetadata): FileDiffMetadata => (diffPlainTextFallback ? { ...fileDiff, lang: "text" } : fileDiff),
        [diffPlainTextFallback],
    );

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredDiffs = useMemo(() => {
        const forcedVisiblePath = showUnviewedOnly ? activeFile : undefined;
        return fileDiffs.filter((fileDiff, index) => {
            const filePath = getFilePath(fileDiff, index);
            const path = filePath.toLowerCase();
            const matchesSearch = !normalizedSearch || path.includes(normalizedSearch);
            const matchesViewedFilter = !showUnviewedOnly || forcedVisiblePath === filePath || !viewedFiles.has(filePath);
            return matchesSearch && matchesViewedFilter;
        });
    }, [activeFile, fileDiffs, normalizedSearch, showUnviewedOnly, viewedFiles]);

    const diffByPath = useMemo(() => {
        const map = new Map<string, FileDiffMetadata>();
        fileDiffs.forEach((fileDiff, index) => {
            const path = getFilePath(fileDiff, index);
            if (!map.has(path)) map.set(path, fileDiff);
        });
        return map;
    }, [fileDiffs]);
    const fileDiffFingerprints = workerDerived.fileDiffFingerprints;
    const selectableDiffPathSet = useMemo(() => new Set(diffByPath.keys()), [diffByPath]);

    const visibleFilePaths = useMemo(() => {
        const seen = new Set<string>();
        const values: string[] = [];
        filteredDiffs.forEach((fileDiff, index) => {
            const path = getFilePath(fileDiff, index);
            if (seen.has(path)) return;
            seen.add(path);
            values.push(path);
        });
        return values;
    }, [filteredDiffs]);

    const settingsPathSet = useMemo(() => new Set(settingsTreeItems.map((item) => item.path)), [settingsTreeItems]);
    const visiblePathSet = useMemo(() => new Set([PR_SUMMARY_PATH, ...visibleFilePaths]), [visibleFilePaths]);
    const allowedPathSet = useMemo(() => (showSettingsPanel ? settingsPathSet : visiblePathSet), [settingsPathSet, showSettingsPanel, visiblePathSet]);

    const treeFilePaths = useMemo(() => allFiles().map((file) => file.path), [allFiles]);
    const directoryPaths = useMemo(() => collectDirectoryPaths(root), [root]);
    const treeOrderedVisiblePaths = useMemo(() => {
        if (treeFilePaths.length === 0) return [];
        return treeFilePaths.filter((path) => visiblePathSet.has(path));
    }, [treeFilePaths, visiblePathSet]);

    const allModeDiffEntries = useMemo(() => {
        const byPath = new Map<string, FileDiffMetadata>();
        const ordered: Array<{ filePath: string; fileDiff: FileDiffMetadata }> = [];

        filteredDiffs.forEach((fileDiff, index) => {
            const path = getFilePath(fileDiff, index);
            if (!byPath.has(path)) byPath.set(path, fileDiff);
        });

        for (const path of treeOrderedVisiblePaths) {
            const fileDiff = byPath.get(path);
            if (!fileDiff) continue;
            ordered.push({ filePath: path, fileDiff });
            byPath.delete(path);
        }

        filteredDiffs.forEach((fileDiff, index) => {
            const path = getFilePath(fileDiff, index);
            if (!byPath.has(path)) return;
            ordered.push({ filePath: path, fileDiff });
            byPath.delete(path);
        });

        return ordered;
    }, [filteredDiffs, treeOrderedVisiblePaths]);

    const selectedFilePath = useMemo(() => {
        if (!activeFile) return undefined;
        if (!diffByPath.has(activeFile)) return undefined;
        return activeFile;
    }, [activeFile, diffByPath]);

    const selectedFileDiff = useMemo(() => {
        if (!selectedFilePath) return undefined;
        return diffByPath.get(selectedFilePath);
    }, [diffByPath, selectedFilePath]);

    const isSummarySelected = activeFile === PR_SUMMARY_PATH;
    const threads = workerDerived.threads;
    const unresolvedThreads = threads.filter((thread) => !thread.root.resolution && !thread.root.deleted);

    const threadsByPath = useMemo(() => {
        const grouped = new Map<string, CommentThread[]>();
        for (const thread of threads) {
            const path = getCommentPath(thread.root);
            const bucket = grouped.get(path) ?? [];
            bucket.push(thread);
            grouped.set(path, bucket);
        }
        return grouped;
    }, [threads]);

    const selectedThreads = useMemo(() => {
        if (!selectedFilePath) return [] as CommentThread[];
        return sortThreadsByCreatedAt(threadsByPath.get(selectedFilePath) ?? []);
    }, [selectedFilePath, threadsByPath]);

    const selectedFileLevelThreads = useMemo(
        () => selectedThreads.filter((thread) => !thread.root.deleted && !getCommentInlinePosition(thread.root)),
        [selectedThreads],
    );

    const lineStats = useMemo(() => linesUpdated(prData?.diffstat ?? []), [prData?.diffstat]);
    const navbarStatusDate = useMemo(() => {
        if (!pullRequest) return "Unknown";
        return formatNavbarDate(pullRequest.mergedAt ?? pullRequest.closedAt ?? pullRequest.updatedAt);
    }, [pullRequest]);
    const navbarState = useMemo(() => normalizeNavbarState(pullRequest), [pullRequest]);

    const fileLineStats = useMemo(() => {
        const map = new Map<string, { added: number; removed: number }>();
        for (const entry of prData?.diffstat ?? []) {
            const path = entry.new?.path ?? entry.old?.path;
            if (!path) continue;
            map.set(path, {
                added: Number(entry.linesAdded ?? 0),
                removed: Number(entry.linesRemoved ?? 0),
            });
        }
        return map;
    }, [prData?.diffstat]);

    const handleDiffLineEnter = useCallback((props: OnDiffLineEnterLeaveProps) => {
        props.lineElement.style.cursor = "copy";
        if (props.numberElement) props.numberElement.style.cursor = "copy";
    }, []);

    const handleDiffLineLeave = useCallback((props: OnDiffLineEnterLeaveProps) => {
        props.lineElement.style.cursor = "";
        if (props.numberElement) props.numberElement.style.cursor = "";
    }, []);

    const handleSingleDiffLineClick = useCallback(
        (props: OnDiffLineClickProps) => {
            if (!selectedFilePath) return;
            onOpenInlineCommentDraft(selectedFilePath, props);
        },
        [onOpenInlineCommentDraft, selectedFilePath],
    );

    const buildFileAnnotations = useCallback(
        (filePath: string) => {
            const fileThreads = (threadsByPath.get(filePath) ?? []).filter((thread) => !thread.root.deleted && Boolean(getCommentInlinePosition(thread.root)));
            const annotations: SingleFileAnnotation[] = [];

            for (const thread of fileThreads) {
                const position = getCommentInlinePosition(thread.root);
                if (!position) continue;
                annotations.push({
                    side: position.side,
                    lineNumber: position.lineNumber,
                    metadata: { kind: "thread", thread },
                });
            }

            if (inlineComment && inlineComment.path === filePath) {
                annotations.push({
                    side: inlineComment.side,
                    lineNumber: inlineComment.line,
                    metadata: { kind: "draft", draft: inlineComment },
                });
            }

            return annotations;
        },
        [inlineComment, threadsByPath],
    );

    const singleFileAnnotations = useMemo(() => {
        if (!selectedFilePath) return [] as SingleFileAnnotation[];
        return buildFileAnnotations(selectedFilePath);
    }, [buildFileAnnotations, selectedFilePath]);

    const singleFileDiffOptions = useMemo<FileDiffOptions<undefined>>(
        () => ({
            ...compactDiffOptions,
            onLineClick: handleSingleDiffLineClick,
            onLineNumberClick: handleSingleDiffLineClick,
            onLineEnter: handleDiffLineEnter,
            onLineLeave: handleDiffLineLeave,
        }),
        [compactDiffOptions, handleDiffLineEnter, handleDiffLineLeave, handleSingleDiffLineClick],
    );

    return {
        diffHighlighterReady,
        toRenderableFileDiff,
        settingsPathSet,
        selectableDiffPathSet,
        visiblePathSet,
        allowedPathSet,
        directoryPaths,
        treeOrderedVisiblePaths,
        allModeDiffEntries,
        selectedFilePath,
        selectedFileDiff,
        isSummarySelected,
        unresolvedThreads,
        threadsByPath,
        selectedFileLevelThreads,
        lineStats,
        navbarStatusDate,
        navbarState,
        fileLineStats,
        handleDiffLineEnter,
        handleDiffLineLeave,
        buildFileAnnotations,
        singleFileAnnotations,
        singleFileDiffOptions,
        fileDiffFingerprints,
    };
}

function applyFullContext(fileDiff: FileDiffMetadata, context: { oldLines: string[]; newLines: string[] }): FileDiffMetadata {
    const hunks = fileDiff.hunks.map((hunk, index, all) => {
        const collapsedBefore = calculateCollapsedBefore(all, index);
        if (collapsedBefore === hunk.collapsedBefore) return hunk;
        return { ...hunk, collapsedBefore };
    });
    return {
        ...fileDiff,
        hunks,
        oldLines: context.oldLines,
        newLines: context.newLines,
    };
}

function calculateCollapsedBefore(hunks: FileDiffMetadata["hunks"], index: number) {
    const hunk = hunks[index];
    const currentStart = hunk.additionStart ?? hunk.deletionStart ?? 1;
    if (index === 0) {
        return Math.max(0, currentStart - 1);
    }
    const prev = hunks[index - 1];
    const prevStart = prev.additionStart ?? prev.deletionStart ?? 1;
    const prevEnd = prevStart + prev.splitLineCount;
    return Math.max(0, currentStart - prevEnd);
}
