import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useCallback, useMemo } from "react";
import { useDiffPlainTextFallback } from "@/features/review/hooks/use-diff-highlighter";
import { applyFullContext, type FullFileContext } from "@/features/review/model/full-file-context";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/features/review/model/pr-summary";
import { buildFileDiffFingerprint } from "@/features/review/model/review-file-fingerprint";
import { linesUpdated } from "@/features/review/model/review-formatters";
import { createOmnibarFilePaths, getFilePath, type ReviewSidebarThreadItem, type SingleFileAnnotation } from "@/features/review/model/review-page-model";
import { buildCommentThreads, type CommentThread, flattenThread, sortThreadsByCreatedAt } from "@/features/review/model/review-threads";
import { type FileTreeEntry, orderFileTreePaths } from "@/lib/file-tree-order";
import { commentLinePosition, type PullRequestBundle } from "@/lib/git-host/types";
import type { InlineDraftLocation } from "@/lib/storage";
import { timestampValue } from "@/lib/timestamp";

const EMPTY_COMMENTS: PullRequestBundle["comments"] = [];

function latestActivityAt(thread: CommentThread) {
    return flattenThread(thread).reduce<string | undefined>((latest, comment) => {
        const candidate = comment.updatedAt ?? comment.createdAt;
        if (!candidate) return latest;
        if (!latest) return candidate;
        return timestampValue(candidate) > timestampValue(latest) ? candidate : latest;
    }, undefined);
}

function firstDiffByPath(fileDiffs: FileDiffMetadata[]) {
    const map = new Map<string, FileDiffMetadata>();
    fileDiffs.forEach((fileDiff, index) => {
        const path = getFilePath(fileDiff, index);
        if (!map.has(path)) map.set(path, fileDiff);
    });
    return map;
}

/** Parsing and fingerprints depend only on the diff text, so they can feed viewed state before filtering. */
export function useParsedDiff(diffText: string) {
    return useMemo(() => {
        const rawFileDiffs = diffText ? parsePatchFiles(diffText).flatMap((patch) => patch.files) : [];
        const rawDiffByPath = firstDiffByPath(rawFileDiffs);
        const fileDiffFingerprints = new Map<string, string>();
        for (const [path, fileDiff] of rawDiffByPath) fileDiffFingerprints.set(path, buildFileDiffFingerprint(fileDiff));
        return { rawFileDiffs, rawDiffByPath, fileDiffFingerprints };
    }, [diffText]);
}

export function useReviewDiffModel({
    parsedDiff,
    prData,
    activeFile,
    showUnviewedOnly,
    searchQuery,
    showSettingsPanel,
    viewedFiles,
    settingsTreeItems,
    inlineDraft,
    fullFileContexts,
}: {
    parsedDiff: ReturnType<typeof useParsedDiff>;
    prData: PullRequestBundle | undefined;
    activeFile: string | undefined;
    showUnviewedOnly: boolean;
    searchQuery: string;
    showSettingsPanel: boolean;
    viewedFiles: Set<string>;
    settingsTreeItems: Array<{ name: string; path: string }>;
    inlineDraft: InlineDraftLocation | null;
    fullFileContexts: Record<string, FullFileContext>;
}) {
    const comments = prData?.comments ?? EMPTY_COMMENTS;
    const { rawFileDiffs, rawDiffByPath } = parsedDiff;
    const threads = useMemo(() => buildCommentThreads(comments), [comments]);

    const fileDiffs = useMemo(() => {
        if (Object.keys(fullFileContexts).length === 0) return rawFileDiffs;
        return rawFileDiffs.map((fileDiff, index) => {
            const context = fullFileContexts[getFilePath(fileDiff, index)];
            return context ? applyFullContext(fileDiff, context) : fileDiff;
        });
    }, [rawFileDiffs, fullFileContexts]);

    const diffPlainTextFallback = useDiffPlainTextFallback(fileDiffs);
    const toRenderableFileDiff = useCallback(
        (fileDiff: FileDiffMetadata): FileDiffMetadata => (diffPlainTextFallback ? { ...fileDiff, lang: "text" } : fileDiff),
        [diffPlainTextFallback],
    );

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const isVisiblePath = useCallback(
        (path: string) => {
            const matchesSearch = !normalizedSearch || path.toLowerCase().includes(normalizedSearch);
            const matchesViewedFilter = !showUnviewedOnly || activeFile === path || !viewedFiles.has(path);
            return matchesSearch && matchesViewedFilter;
        },
        [activeFile, normalizedSearch, showUnviewedOnly, viewedFiles],
    );
    const filteredDiffs = useMemo(() => fileDiffs.filter((fileDiff, index) => isVisiblePath(getFilePath(fileDiff, index))), [fileDiffs, isVisiblePath]);
    const diffByPath = useMemo(() => firstDiffByPath(fileDiffs), [fileDiffs]);
    const omnibarFilePaths = useMemo(() => {
        const fallbackPaths = (prData?.diffstat ?? []).flatMap((entry) => entry.new?.path ?? entry.old?.path ?? []);
        return createOmnibarFilePaths(Array.from(diffByPath.keys()), fallbackPaths);
    }, [diffByPath, prData?.diffstat]);
    const selectableDiffPathSet = useMemo(() => new Set(diffByPath.keys()), [diffByPath]);

    // The diffstat can list files while the diff text is still loading or was truncated.
    const visibleFilePaths = useMemo(() => {
        const fromDiffs = Array.from(firstDiffByPath(filteredDiffs).keys());
        if (fromDiffs.length > 0) return fromDiffs;
        const fromDiffstat = (prData?.diffstat ?? []).flatMap((entry) => entry.new?.path ?? entry.old?.path ?? []);
        return Array.from(new Set(fromDiffstat)).filter(isVisiblePath);
    }, [filteredDiffs, isVisiblePath, prData?.diffstat]);
    const treeOrderedFilePaths = useMemo(() => orderFileTreePaths(visibleFilePaths), [visibleFilePaths]);

    const settingsPathSet = useMemo(() => new Set(settingsTreeItems.map((item) => item.path)), [settingsTreeItems]);
    const visiblePathSet = useMemo(() => new Set([PR_SUMMARY_PATH, ...visibleFilePaths]), [visibleFilePaths]);
    const treeOrderedVisiblePaths = useMemo(() => [PR_SUMMARY_PATH, ...treeOrderedFilePaths], [treeOrderedFilePaths]);
    const treeEntries = useMemo<FileTreeEntry[]>(() => {
        if (showSettingsPanel) return settingsTreeItems.map((item) => ({ appPath: item.path, treePath: item.name }));
        return [{ appPath: PR_SUMMARY_PATH, treePath: PR_SUMMARY_NAME }, ...visibleFilePaths.map((path) => ({ appPath: path, treePath: path }))];
    }, [settingsTreeItems, showSettingsPanel, visibleFilePaths]);
    const allModeDiffEntries = useMemo(() => {
        const remaining = firstDiffByPath(filteredDiffs);
        const ordered: Array<{ filePath: string; fileDiff: FileDiffMetadata }> = [];
        for (const path of [...treeOrderedVisiblePaths, ...remaining.keys()]) {
            const fileDiff = remaining.get(path);
            if (!fileDiff) continue;
            ordered.push({ filePath: path, fileDiff });
            remaining.delete(path);
        }
        return ordered;
    }, [filteredDiffs, treeOrderedVisiblePaths]);

    const selectedFilePath = activeFile && selectableDiffPathSet.has(activeFile) ? activeFile : undefined;
    const selectedFileDiff = selectedFilePath ? diffByPath.get(selectedFilePath) : undefined;
    const isSummarySelected = activeFile === PR_SUMMARY_PATH;

    const threadsByPath = useMemo(() => {
        const grouped = new Map<string, CommentThread[]>();
        for (const thread of threads) {
            const path = thread.root.comment.inline?.path ?? "";
            grouped.set(path, [...(grouped.get(path) ?? []), thread]);
        }
        return grouped;
    }, [threads]);
    const sidebarThreads = useMemo(() => {
        const items: ReviewSidebarThreadItem[] = [];
        for (const thread of threads) {
            const rootComment = thread.root.comment;
            const path = rootComment.inline?.path;
            if (rootComment.deleted || !path) continue;
            const position = commentLinePosition(rootComment.inline);
            items.push({
                commentId: rootComment.id,
                isResolved: Boolean(rootComment.resolution),
                path,
                line: position?.lineNumber,
                side: position?.side,
                replyCount: Math.max(0, flattenThread(thread).length - 1),
                latestActivityAt: latestActivityAt(thread),
                thread,
            });
        }
        return items.sort((left, right) => timestampValue(right.latestActivityAt) - timestampValue(left.latestActivityAt));
    }, [threads]);
    const selectedFileLevelThreads = useMemo(() => {
        const selected = selectedFilePath ? sortThreadsByCreatedAt(threadsByPath.get(selectedFilePath) ?? []) : [];
        return selected.filter((thread) => !thread.root.comment.deleted && !commentLinePosition(thread.root.comment.inline));
    }, [selectedFilePath, threadsByPath]);

    const lineStats = useMemo(() => linesUpdated(prData?.diffstat ?? []), [prData?.diffstat]);
    const fileLineStats = useMemo(() => {
        const map = new Map<string, { added: number; removed: number }>();
        for (const entry of prData?.diffstat ?? []) {
            const path = entry.new?.path ?? entry.old?.path;
            if (path) map.set(path, { added: Number(entry.linesAdded ?? 0), removed: Number(entry.linesRemoved ?? 0) });
        }
        return map;
    }, [prData?.diffstat]);

    const buildFileAnnotations = useCallback(
        (filePath: string) => {
            const suggestionSourceFileDiff = rawDiffByPath.get(filePath);
            const annotations: SingleFileAnnotation[] = [];
            for (const thread of threadsByPath.get(filePath) ?? []) {
                const position = commentLinePosition(thread.root.comment.inline);
                if (thread.root.comment.deleted || !position) continue;
                annotations.push({ side: position.side, lineNumber: position.lineNumber, metadata: { kind: "thread", thread, suggestionSourceFileDiff } });
            }
            if (inlineDraft?.path === filePath) {
                annotations.push({ side: inlineDraft.side, lineNumber: inlineDraft.line, metadata: { kind: "draft", draft: inlineDraft } });
            }
            return annotations;
        },
        [inlineDraft, rawDiffByPath, threadsByPath],
    );

    return {
        toRenderableFileDiff,
        settingsPathSet,
        selectableDiffPathSet,
        visiblePathSet,
        treeEntries,
        omnibarFilePaths,
        treeOrderedVisiblePaths,
        allModeDiffEntries,
        selectedFilePath,
        selectedFileDiff,
        isSummarySelected,
        sidebarThreads,
        threadsByPath,
        selectedFileLevelThreads,
        lineStats,
        fileLineStats,
        buildFileAnnotations,
    };
}
