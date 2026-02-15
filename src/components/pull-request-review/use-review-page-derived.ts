import { type FileDiffOptions, getFiletypeFromFileName, type OnDiffLineClickProps, type OnDiffLineEnterLeaveProps, parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useCallback, useMemo } from "react";
import { formatNavbarDate, linesUpdated, normalizeNavbarState } from "@/components/pull-request-review/review-formatters";
import { useDiffHighlighterState } from "@/components/pull-request-review/use-review-page-effects";
import type { FileNode } from "@/lib/file-tree-context";
import type { PullRequestBundle, PullRequestDetails } from "@/lib/git-host/types";
import { PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { collectDirectoryPaths, getCommentInlinePosition, getCommentPath, getFilePath, type SingleFileAnnotation } from "./review-page-model";
import type { CommentThread } from "./review-threads";
import { buildCommentThreads, sortThreadsByCreatedAt } from "./review-threads";
import type { InlineCommentDraft } from "./use-inline-comment-drafts";

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
}) {
    const diffText = prData?.diff ?? "";

    const fileDiffs = useMemo(() => {
        if (!diffText) return [] as FileDiffMetadata[];
        const patches = parsePatchFiles(diffText);
        return patches.flatMap((patch) => patch.files);
    }, [diffText]);

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
        return fileDiffs.filter((fileDiff, index) => {
            const filePath = getFilePath(fileDiff, index);
            const path = filePath.toLowerCase();
            const matchesSearch = !normalizedSearch || path.includes(normalizedSearch);
            const matchesViewedFilter = !showUnviewedOnly || !viewedFiles.has(filePath);
            return matchesSearch && matchesViewedFilter;
        });
    }, [fileDiffs, normalizedSearch, showUnviewedOnly, viewedFiles]);

    const diffByPath = useMemo(() => {
        const map = new Map<string, FileDiffMetadata>();
        fileDiffs.forEach((fileDiff, index) => {
            const path = getFilePath(fileDiff, index);
            if (!map.has(path)) map.set(path, fileDiff);
        });
        return map;
    }, [fileDiffs]);

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
    const comments = prData?.comments ?? [];
    const threads = useMemo(() => buildCommentThreads(comments), [comments]);
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
    };
}
