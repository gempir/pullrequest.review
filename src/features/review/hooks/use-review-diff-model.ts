import { type FileDiffOptions, getFiletypeFromFileName, type OnDiffLineEnterLeaveProps, parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { useCallback, useMemo } from "react";
import type { FileTreeEntry } from "@/components/file-tree";
import { useDiffHighlighterState } from "@/features/review/hooks/use-review-page-effects";
import { linesUpdated, normalizeNavbarState } from "@/features/review/model/review-formatters";
import {
    type CommentLineSide,
    createOmnibarFilePaths,
    getCommentInlinePosition,
    getCommentPath,
    getFilePath,
    type InlineCommentLineTarget,
    type SingleFileAnnotation,
    type SingleFileAnnotationMetadata,
} from "@/features/review/model/review-page-model";
import { buildCommentThreads, type CommentThread, flattenThread, sortThreadsByCreatedAt } from "@/features/review/model/review-threads";
import { orderFileTreePaths } from "@/lib/file-tree-order";
import type { PullRequestBundle, PullRequestDetails } from "@/lib/git-host/types";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";
import { buildFileDiffFingerprint } from "@/lib/review-file-fingerprint";
import type { InlineDraftLocation } from "@/lib/storage";
import { timestampValue } from "@/lib/timestamp";

export type ReviewSidebarThreadItem = {
    commentId: number;
    isResolved: boolean;
    path: string;
    line?: number;
    side?: CommentLineSide;
    replyCount: number;
    latestActivityAt?: string;
    thread: CommentThread;
};

const EMPTY_COMMENTS: PullRequestBundle["comments"] = [];
const INLINE_COMMENT_TRIGGER_ATTR = "data-inline-comment-trigger";
const INLINE_COMMENT_TRIGGER_ID_ATTR = "data-inline-comment-trigger-id";
const INLINE_COMMENT_TRIGGER_LABEL = "Add line comment";

function normalizeDiffSelectionPath(path: string) {
    const trimmed = path.trim();
    if (!trimmed || trimmed === "/dev/null") return "";
    return /^[abc]\//.test(trimmed) ? trimmed.slice(2) : trimmed;
}

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

function byNormalizedPath(diffByPath: Map<string, FileDiffMetadata>) {
    const map = new Map<string, FileDiffMetadata>();
    for (const [path, fileDiff] of diffByPath) {
        const normalizedPath = normalizeDiffSelectionPath(path);
        if (normalizedPath && !map.has(normalizedPath)) map.set(normalizedPath, fileDiff);
    }
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
    pullRequest,
    activeFile,
    showUnviewedOnly,
    searchQuery,
    showSettingsPanel,
    viewedFiles,
    settingsTreeItems,
    inlineComment,
    theme,
    fullFileContexts,
}: {
    parsedDiff: ReturnType<typeof useParsedDiff>;
    prData: PullRequestBundle | undefined;
    pullRequest: PullRequestDetails | undefined;
    activeFile: string | undefined;
    showUnviewedOnly: boolean;
    searchQuery: string;
    showSettingsPanel: boolean;
    viewedFiles: Set<string>;
    settingsTreeItems: Array<{ name: string; path: string }>;
    inlineComment: InlineDraftLocation | null;
    theme: string;
    fullFileContexts: Record<string, { oldLines: string[]; newLines: string[] }>;
}) {
    const comments = prData?.comments ?? EMPTY_COMMENTS;
    const { rawFileDiffs, rawDiffByPath } = parsedDiff;
    const rawDiffByNormalizedPath = useMemo(() => byNormalizedPath(rawDiffByPath), [rawDiffByPath]);
    const threads = useMemo(() => buildCommentThreads(comments), [comments]);

    const fileDiffs = useMemo(() => {
        if (Object.keys(fullFileContexts).length === 0) return rawFileDiffs;
        return rawFileDiffs.map((fileDiff, index) => {
            const context = fullFileContexts[getFilePath(fileDiff, index)];
            return context ? applyFullContext(fileDiff, context) : fileDiff;
        });
    }, [rawFileDiffs, fullFileContexts]);

    const preloadLanguages = useMemo(() => {
        const langs = new Set<string>(["text", "javascript"]);
        for (const fileDiff of fileDiffs) {
            if (fileDiff.lang) langs.add(fileDiff.lang);
            langs.add(getFiletypeFromFileName(fileDiff.name));
            if (fileDiff.prevName) langs.add(getFiletypeFromFileName(fileDiff.prevName));
        }
        return [...langs];
    }, [fileDiffs]);
    const { diffPlainTextFallback } = useDiffHighlighterState({ fileDiffs, theme, preloadLanguages });
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
    const diffByNormalizedPath = useMemo(() => byNormalizedPath(diffByPath), [diffByPath]);
    const omnibarFilePaths = useMemo(() => {
        const fallbackPaths = (prData?.diffstat ?? []).flatMap((entry) => entry.new?.path ?? entry.old?.path ?? []);
        return createOmnibarFilePaths(Array.from(diffByPath.keys()), fallbackPaths);
    }, [diffByPath, prData?.diffstat]);
    const selectableDiffPathSet = useMemo(() => {
        const paths = new Set<string>();
        for (const path of diffByPath.keys()) {
            paths.add(path);
            const normalizedPath = normalizeDiffSelectionPath(path);
            if (normalizedPath) paths.add(normalizedPath);
        }
        return paths;
    }, [diffByPath]);

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
    const selectedFileDiff = useMemo(() => {
        if (!selectedFilePath) return undefined;
        return diffByPath.get(selectedFilePath) ?? diffByNormalizedPath.get(normalizeDiffSelectionPath(selectedFilePath));
    }, [diffByNormalizedPath, diffByPath, selectedFilePath]);
    const isSummarySelected = activeFile === PR_SUMMARY_PATH;

    const threadsByPath = useMemo(() => {
        const grouped = new Map<string, CommentThread[]>();
        for (const thread of threads) {
            const path = getCommentPath(thread.root.comment);
            grouped.set(path, [...(grouped.get(path) ?? []), thread]);
        }
        return grouped;
    }, [threads]);
    const sidebarThreads = useMemo(() => {
        const items: ReviewSidebarThreadItem[] = [];
        for (const thread of threads) {
            const rootComment = thread.root.comment;
            const path = getCommentPath(rootComment);
            if (rootComment.deleted || !path) continue;
            const position = getCommentInlinePosition(rootComment);
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
        return selected.filter((thread) => !thread.root.comment.deleted && !getCommentInlinePosition(thread.root.comment));
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

    const removeInlineCommentTriggerButton = useCallback((props: OnDiffLineEnterLeaveProps) => {
        const numberElement = props.numberElement;
        if (!numberElement) return;
        const button = numberElement.querySelector<HTMLElement>(`[${INLINE_COMMENT_TRIGGER_ATTR}="true"]`);
        if (button) {
            button.remove();
        }
    }, []);

    const handleDiffLineEnter = useCallback(
        (props: OnDiffLineEnterLeaveProps, onOpenInlineDraft?: (target: InlineCommentLineTarget) => void) => {
            props.lineElement.style.cursor = "";
            const numberElement = props.numberElement;
            if (!numberElement) return;
            numberElement.style.cursor = onOpenInlineDraft ? "pointer" : "";
            removeInlineCommentTriggerButton(props);
            if (!onOpenInlineDraft) return;

            const button = document.createElement("button");
            button.type = "button";
            button.className =
                "inline-flex h-4 w-4 items-center justify-center rounded border border-status-added/80 bg-status-added/20 text-status-added shadow-sm";
            button.title = INLINE_COMMENT_TRIGGER_LABEL;
            button.setAttribute("aria-label", INLINE_COMMENT_TRIGGER_LABEL);
            button.setAttribute(INLINE_COMMENT_TRIGGER_ATTR, "true");
            button.setAttribute(INLINE_COMMENT_TRIGGER_ID_ATTR, `${props.annotationSide}:${props.lineNumber}`);
            button.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
            button.style.position = "absolute";
            button.style.right = "2px";
            button.style.top = "50%";
            button.style.transform = "translateY(-50%)";
            button.style.cursor = "pointer";
            button.style.zIndex = "2";
            button.onpointerdown = (event) => {
                event.preventDefault();
                event.stopPropagation();
            };
            button.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenInlineDraft({
                    lineNumber: props.lineNumber,
                    annotationSide: props.annotationSide,
                });
            };
            numberElement.style.position = "relative";
            numberElement.style.cursor = "pointer";
            numberElement.appendChild(button);
        },
        [removeInlineCommentTriggerButton],
    );

    const handleDiffLineLeave = useCallback(
        (props: OnDiffLineEnterLeaveProps) => {
            props.lineElement.style.cursor = "";
            if (props.numberElement) props.numberElement.style.cursor = "";
            removeInlineCommentTriggerButton(props);
        },
        [removeInlineCommentTriggerButton],
    );

    const buildFileAnnotations = useCallback(
        (filePath: string) => {
            const suggestionSourceFileDiff = rawDiffByPath.get(filePath) ?? rawDiffByNormalizedPath.get(normalizeDiffSelectionPath(filePath));
            const annotations: SingleFileAnnotation[] = [];
            for (const thread of threadsByPath.get(filePath) ?? []) {
                const position = getCommentInlinePosition(thread.root.comment);
                if (thread.root.comment.deleted || !position) continue;
                annotations.push({ side: position.side, lineNumber: position.lineNumber, metadata: { kind: "thread", thread, suggestionSourceFileDiff } });
            }
            if (inlineComment?.path === filePath) {
                annotations.push({ side: inlineComment.side, lineNumber: inlineComment.line, metadata: { kind: "draft", draft: inlineComment } });
            }
            return annotations;
        },
        [inlineComment, rawDiffByNormalizedPath, rawDiffByPath, threadsByPath],
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
        navbarStatusTimestamp: pullRequest?.mergedAt ?? pullRequest?.closedAt ?? pullRequest?.updatedAt,
        navbarState: normalizeNavbarState(pullRequest),
        fileLineStats,
        handleDiffLineEnter,
        handleDiffLineLeave,
        buildFileAnnotations,
    };
}

export type DiffLineEnterHandler = (props: OnDiffLineEnterLeaveProps, onOpenInlineDraft?: (target: InlineCommentLineTarget) => void) => void;
export type ReviewFileDiffOptions = FileDiffOptions<SingleFileAnnotationMetadata | undefined, undefined>;

function applyFullContext(fileDiff: FileDiffMetadata, context: { oldLines: string[]; newLines: string[] }): FileDiffMetadata {
    let splitLineStart = 0;
    let unifiedLineStart = 0;

    const hunks = fileDiff.hunks.map((hunk, index, all) => {
        const collapsedBefore = calculateCollapsedBefore(all, index);
        splitLineStart += collapsedBefore;
        unifiedLineStart += collapsedBefore;

        const nextHunk = {
            ...hunk,
            collapsedBefore,
            additionLineIndex: toFullFileLineIndex(hunk.additionStart),
            deletionLineIndex: toFullFileLineIndex(hunk.deletionStart),
            splitLineStart,
            unifiedLineStart,
        };

        splitLineStart += hunk.splitLineCount;
        unifiedLineStart += hunk.unifiedLineCount;

        return nextHunk;
    });

    const lastHunk = hunks.at(-1);
    const trailingContext =
        lastHunk == null
            ? Math.min(context.oldLines.length, context.newLines.length)
            : Math.max(
                  0,
                  Math.min(
                      context.oldLines.length - (lastHunk.deletionLineIndex + lastHunk.deletionCount),
                      context.newLines.length - (lastHunk.additionLineIndex + lastHunk.additionCount),
                  ),
              );

    return {
        ...fileDiff,
        cacheKey: fileDiff.cacheKey ? `${fileDiff.cacheKey}:full-context:${context.oldLines.length}:${context.newLines.length}` : undefined,
        hunks,
        isPartial: false,
        deletionLines: context.oldLines,
        additionLines: context.newLines,
        splitLineCount: splitLineStart + trailingContext,
        unifiedLineCount: unifiedLineStart + trailingContext,
    };
}

function calculateCollapsedBefore(hunks: FileDiffMetadata["hunks"], index: number) {
    const hunk = hunks[index];
    const currentStart = getHunkContextStart(hunk);
    if (index === 0) {
        return Math.max(0, currentStart - 1);
    }
    const prev = hunks[index - 1];
    const prevEnd = getHunkContextEnd(prev);
    return Math.max(0, currentStart - prevEnd);
}

function getHunkContextStart(hunk: FileDiffMetadata["hunks"][number]) {
    const starts = [hunk.additionStart, hunk.deletionStart].filter((lineNumber) => lineNumber > 0);
    return starts.length > 0 ? Math.min(...starts) : 1;
}

function getHunkContextEnd(hunk: FileDiffMetadata["hunks"][number]) {
    const ends = [
        hunk.additionStart > 0 ? hunk.additionStart + hunk.additionCount : undefined,
        hunk.deletionStart > 0 ? hunk.deletionStart + hunk.deletionCount : undefined,
    ].filter((lineNumber): lineNumber is number => typeof lineNumber === "number");
    return ends.length > 0 ? Math.min(...ends) : 1;
}

function toFullFileLineIndex(lineNumber: number) {
    return Math.max(0, lineNumber - 1);
}
