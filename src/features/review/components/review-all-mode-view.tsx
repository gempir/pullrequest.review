import { useVirtualizer } from "@tanstack/react-virtual";
import { ScrollText } from "lucide-react";
import { useEffect, useMemo } from "react";
import { RepositoryFileIcon } from "@/components/repository-file-icon";
import { DiffContextButton } from "@/features/review/components/diff-context-button";
import { PullRequestSummaryPanel } from "@/features/review/components/pr-summary-panel";
import { useReview } from "@/features/review/components/review-context";
import { ReviewDiffSettingsMenu } from "@/features/review/components/review-diff-settings-menu";
import { AllViewedToggle, CopyPathButton, ViewedToggle } from "@/features/review/components/review-file-controls";
import { ReviewFileDiff } from "@/features/review/components/review-file-diff";
import { ReviewSummaryCommentComposer } from "@/features/review/components/review-summary-comment-composer";
import { fileAnchorId } from "@/features/review/model/file-anchors";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/features/review/model/pr-summary";
import { cn } from "@/lib/utils";

const STICKY_HEADER_CLASS =
    "group sticky top-0 z-20 h-10 min-w-0 bg-chrome border-y border-border-muted -mt-px px-3 flex items-center gap-2 overflow-hidden text-[12px]";

function AllModeSummary() {
    const review = useReview();
    const { isSummaryCollapsedInAllMode: collapsed, viewMode, setViewMode, openDiffSettings } = review;
    const { lineStats } = review.model;
    return (
        <div id={fileAnchorId(PR_SUMMARY_PATH)} className={cn("w-full max-w-full", collapsed && "border-b-0")}>
            <div className={STICKY_HEADER_CLASS}>
                <button type="button" className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden text-left" onClick={review.toggleSummaryCollapsed}>
                    <span className="size-4 flex items-center justify-center shrink-0">
                        <ScrollText className="size-3.5" />
                    </span>
                    <span className="min-w-0 max-w-full truncate text-[13px] font-medium">{review.pullRequestTitle || PR_SUMMARY_NAME}</span>
                </button>
                <div className="shrink-0 text-[12px] tabular-nums">
                    <span className="text-status-added">+{lineStats.added}</span>
                    <span className="ml-2 text-status-removed">-{lineStats.removed}</span>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                    <ReviewDiffSettingsMenu viewMode={viewMode} onViewModeChange={setViewMode} onOpenDiffSettings={openDiffSettings} />
                    <AllViewedToggle />
                </div>
            </div>
            {!collapsed && (
                <PullRequestSummaryPanel
                    {...review.summaryProps}
                    bundle={review.prData}
                    diffStats={lineStats}
                    composer={<ReviewSummaryCommentComposer key={review.pullRequestId} {...review.summaryComposer} />}
                />
            )}
        </div>
    );
}

export function ReviewAllModeView() {
    const review = useReview();
    const { model, collapsedAllModeFiles, collapseViewedFilesByDefault, viewedFiles, fileContextState, pendingScrollPath, diffScrollRef } = review;
    const { allModeDiffEntries, threadsByPath, fileLineStats } = model;
    const filePathsInOrder = useMemo(() => allModeDiffEntries.map((entry) => entry.filePath), [allModeDiffEntries]);
    const rowVirtualizer = useVirtualizer({
        count: allModeDiffEntries.length,
        getScrollElement: () => diffScrollRef.current,
        estimateSize: () => 420,
        overscan: 4,
    });
    const virtualRows = rowVirtualizer.getVirtualItems();
    const paddingTop = virtualRows[0]?.start ?? 0;
    const paddingBottom = Math.max(0, rowVirtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0));

    useEffect(() => {
        if (!pendingScrollPath) return;
        const index = filePathsInOrder.indexOf(pendingScrollPath);
        if (index >= 0) rowVirtualizer.scrollToIndex(index, { align: "start" });
    }, [filePathsInOrder, pendingScrollPath, rowVirtualizer]);

    return (
        <div className="w-full max-w-full" data-component="diff-list-view" style={{ paddingBottom: "max(420px, 90vh)" }}>
            <AllModeSummary />

            {paddingTop > 0 ? <div style={{ height: paddingTop }} /> : null}
            {virtualRows.map((virtualRow) => {
                const entry = allModeDiffEntries[virtualRow.index];
                if (!entry) return null;
                const { fileDiff, filePath } = entry;
                const unresolvedCount = (threadsByPath.get(filePath) ?? []).filter(
                    (thread) => !thread.root.comment.resolution && !thread.root.comment.deleted,
                ).length;
                const stats = fileLineStats.get(filePath);
                const isCollapsed = collapsedAllModeFiles[filePath] ?? (collapseViewedFilesByDefault && viewedFiles.has(filePath));

                return (
                    <div key={filePath} ref={rowVirtualizer.measureElement} data-index={virtualRow.index}>
                        <div id={fileAnchorId(filePath)} className={cn("w-full max-w-full bg-card", isCollapsed && "border-b-0")}>
                            <div className={STICKY_HEADER_CLASS}>
                                <div className="min-w-0 flex flex-1 items-center gap-1">
                                    <button
                                        type="button"
                                        className="mr-1 h-full min-w-0 flex items-center gap-2 overflow-hidden text-left"
                                        onClick={() => review.setFileCollapsed(filePath, !isCollapsed)}
                                    >
                                        <span className="size-4 flex items-center justify-center shrink-0">
                                            <RepositoryFileIcon fileName={filePath.split("/").pop() || filePath} className="size-3.5" />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate font-mono">{filePath}</span>
                                    </button>
                                    <CopyPathButton path={filePath} />
                                    <DiffContextButton state={fileContextState[filePath]} onClick={() => review.onLoadFullFileContext(filePath, fileDiff)} />
                                </div>
                                <div className="ml-auto flex shrink-0 items-center gap-2 text-[12px] tabular-nums">
                                    <span className="select-none text-status-added">+{stats?.added ?? 0}</span>
                                    <span className="select-none text-status-removed">-{stats?.removed ?? 0}</span>
                                    {unresolvedCount > 0 ? <span className="text-muted-foreground">{unresolvedCount} unresolved</span> : null}
                                    <ReviewDiffSettingsMenu
                                        viewMode={review.viewMode}
                                        onViewModeChange={review.setViewMode}
                                        onOpenDiffSettings={review.openDiffSettings}
                                    />
                                    <ViewedToggle path={filePath} />
                                </div>
                            </div>
                            {!isCollapsed ? (
                                <div className="diff-content-scroll min-w-0 w-full max-w-full overflow-x-auto">
                                    <ReviewFileDiff filePath={filePath} fileDiff={fileDiff} />
                                </div>
                            ) : null}
                        </div>
                    </div>
                );
            })}
            {paddingBottom > 0 ? <div style={{ height: paddingBottom }} /> : null}

            {allModeDiffEntries.length === 0 ? (
                <div className="p-12 text-center text-[13px] text-faint-foreground">No files match the current search.</div>
            ) : null}
        </div>
    );
}
