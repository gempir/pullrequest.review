import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { buildPrFileHash, clearableHashFromPath, type PrFileHashTarget, parsePrFileHashTarget } from "@/features/review/model/pr-file-hash";
import { PR_SUMMARY_PATH } from "@/features/review/model/pr-summary";
import type { Comment } from "@/lib/git-host/types";

function resolveCommentFilePath(comments: Comment[], commentId: number) {
    const commentsById = new Map(comments.map((comment) => [comment.id, comment] as const));
    const visited = new Set<number>();
    let comment = commentsById.get(commentId);
    while (comment && !visited.has(comment.id)) {
        if (comment.inline?.path) return comment.inline.path;
        visited.add(comment.id);
        const parentId = comment.parent?.id;
        comment = typeof parentId === "number" ? commentsById.get(parentId) : undefined;
    }
    return undefined;
}

function replaceHash(hash: string | undefined) {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ""}`);
}

/**
 * Two-way binding between the selected file and the URL hash (`#/<path>?comment=<id>`).
 * A hash in the URL selects its file once per navigation; selecting a file writes the hash,
 * except for selections made with `selectWithoutHash` (scroll tracking), which leave the URL alone.
 */
export function useReviewUrlHash({
    activeFile,
    setActiveFile,
    showSettingsPanel,
    settingsPathSet,
    selectableFilePaths,
    isFileSelectionReady,
    comments,
    commentsLoading,
    onHashTarget,
}: {
    activeFile: string | undefined;
    setActiveFile: (path: string) => void;
    showSettingsPanel: boolean;
    settingsPathSet: Set<string>;
    selectableFilePaths: Set<string>;
    isFileSelectionReady: boolean;
    comments: Comment[];
    commentsLoading: boolean;
    onHashTarget: (target: PrFileHashTarget & { path: string }) => void;
}) {
    const quietPathRef = useRef<string | null>(null);
    const resolvedPageRef = useRef<string | null>(null);

    useLayoutEffect(() => {
        const applyHashSelection = () => {
            const page = `${window.location.pathname}${window.location.search}`;
            // Resolve each navigation once. Comment refreshes must not replay an
            // old hash after all-mode scrolling has selected a different file.
            if (resolvedPageRef.current === page) return;
            const target = parsePrFileHashTarget(window.location.hash);
            if (!target) return;
            let path = target.path;
            if (!path && target.commentId !== undefined) {
                if (commentsLoading) return;
                path = resolveCommentFilePath(comments, target.commentId);
            }
            if (!path || !selectableFilePaths.has(path)) return;
            if (!target.path && target.commentId !== undefined) replaceHash(buildPrFileHash(path, target.commentId));
            resolvedPageRef.current = page;
            quietPathRef.current = path;
            onHashTarget({ ...target, path });
        };
        const handleHashChange = () => {
            resolvedPageRef.current = null;
            applyHashSelection();
        };
        applyHashSelection();
        window.addEventListener("hashchange", handleHashChange);
        return () => window.removeEventListener("hashchange", handleHashChange);
    }, [comments, commentsLoading, onHashTarget, selectableFilePaths]);

    useEffect(() => {
        const quiet = Boolean(activeFile) && quietPathRef.current === activeFile;
        quietPathRef.current = null;
        if (quiet) return;
        if (!showSettingsPanel && !activeFile) return;
        if (!showSettingsPanel && activeFile && activeFile !== PR_SUMMARY_PATH && !selectableFilePaths.has(activeFile)) return;

        const hashTarget = parsePrFileHashTarget(window.location.hash);
        if (hashTarget?.commentId && !hashTarget.path) return;
        const hashPath = hashTarget?.path ?? null;
        // Until the diff's files are known, keep a deep-link hash so it can still be applied.
        if (!showSettingsPanel && hashPath && !isFileSelectionReady && (!selectableFilePaths.has(hashPath) || activeFile === PR_SUMMARY_PATH)) return;

        const nextHash = showSettingsPanel
            ? undefined
            : clearableHashFromPath(activeFile, {
                  isSettingsPath: Boolean(activeFile && settingsPathSet.has(activeFile)),
                  commentId: hashPath === activeFile ? hashTarget?.commentId : undefined,
              });
        const currentHash = window.location.hash.replace(/^#/, "");
        if ((nextHash ?? "") !== currentHash) replaceHash(nextHash);
    }, [activeFile, isFileSelectionReady, selectableFilePaths, settingsPathSet, showSettingsPanel]);

    const selectWithoutHash = useCallback(
        (path: string) => {
            quietPathRef.current = path;
            setActiveFile(path);
        },
        [setActiveFile],
    );

    return { selectWithoutHash };
}
