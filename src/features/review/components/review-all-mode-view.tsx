import { useVirtualizer } from "@tanstack/react-virtual";
import { ScrollText } from "lucide-react";
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PullRequestSummaryPanel } from "@/features/review/components/pr-summary-panel";
import { useReview } from "@/features/review/components/review-context";
import { ReviewDiffSettingsMenu } from "@/features/review/components/review-diff-settings-menu";
import { AllViewedToggle } from "@/features/review/components/review-file-controls";
import { ReviewFileDiff } from "@/features/review/components/review-file-diff";
import { ReviewFileHeader } from "@/features/review/components/review-file-header";
import { ReviewSummaryCommentComposer } from "@/features/review/components/review-summary-comment-composer";
import { ALL_MODE_STICKY_OFFSET } from "@/features/review/hooks/use-all-mode-reveal";
import { fileAnchorId } from "@/lib/file-anchors";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";

function AllModeSummary({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
    const review = useReview();
    const { isSummaryCollapsedInAllMode: collapsed, viewMode, setViewMode, openDiffSettings } = review;
    const { lineStats } = review.model;
    return (
        <div ref={containerRef} id={fileAnchorId(PR_SUMMARY_PATH)} className="canvas-card mb-3 w-full max-w-full [overflow:clip]">
            <div className="canvas-sticky-header glass-strong flex h-11 min-w-0 items-center gap-2 overflow-hidden rounded-[15px] border-0 pl-3.5 pr-2.5 shadow-none">
                <button
                    type="button"
                    className="flex h-full min-w-0 flex-1 items-center gap-2 overflow-hidden text-left"
                    onClick={review.toggleSummaryCollapsed}
                >
                    <ScrollText className="size-3.5 shrink-0" />
                    <span className="min-w-0 max-w-full truncate text-[13px] font-semibold">{review.pullRequestTitle || PR_SUMMARY_NAME}</span>
                </button>
                <div className="shrink-0 text-[12px] font-medium tabular-nums">
                    <span className="text-status-added">+{lineStats.added}</span>
                    <span className="ml-2 text-status-removed">-{lineStats.removed}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <ReviewDiffSettingsMenu viewMode={viewMode} onViewModeChange={setViewMode} onOpenDiffSettings={openDiffSettings} />
                    <AllViewedToggle />
                </div>
            </div>
            {!collapsed && (
                <PullRequestSummaryPanel
                    {...review.summaryProps}
                    bundle={review.prData}
                    diffStats={lineStats}
                    footerRight={<ReviewSummaryCommentComposer key={review.pullRequestId} {...review.summaryComposer} />}
                />
            )}
        </div>
    );
}

export function ReviewAllModeView() {
    const review = useReview();
    const { model, collapsedAllModeFiles, collapseViewedFilesByDefault, viewedFiles, pendingScrollPath, diffScrollRef } = review;
    const { allModeDiffEntries, threadsByPath } = model;
    const filePathsInOrder = useMemo(() => allModeDiffEntries.map((entry) => entry.filePath), [allModeDiffEntries]);
    const summaryRef = useRef<HTMLDivElement>(null);
    const rowsStartRef = useRef<HTMLDivElement>(null);
    // Rows start below the summary card, whose height changes as it loads, expands, and collapses.
    const [scrollMargin, setScrollMargin] = useState(0);
    useLayoutEffect(() => {
        const scroller = diffScrollRef.current;
        const summary = summaryRef.current;
        const rowsStart = rowsStartRef.current;
        if (!scroller || !summary || !rowsStart) return;
        const measure = () => setScrollMargin(rowsStart.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(summary);
        return () => observer.disconnect();
    }, [diffScrollRef]);
    const rowVirtualizer = useVirtualizer({
        count: allModeDiffEntries.length,
        getScrollElement: () => diffScrollRef.current,
        estimateSize: () => 420,
        overscan: 4,
        scrollPaddingStart: ALL_MODE_STICKY_OFFSET,
        scrollMargin,
    });
    const virtualRows = rowVirtualizer.getVirtualItems();
    const paddingTop = virtualRows[0] ? virtualRows[0].start - scrollMargin : 0;
    const paddingBottom = Math.max(0, rowVirtualizer.getTotalSize() - (virtualRows.length > 0 ? (virtualRows.at(-1)?.end ?? 0) - scrollMargin : 0));

    useEffect(() => {
        if (!pendingScrollPath) return;
        const index = filePathsInOrder.indexOf(pendingScrollPath);
        if (index >= 0) rowVirtualizer.scrollToIndex(index, { align: "start" });
    }, [filePathsInOrder, pendingScrollPath, rowVirtualizer]);

    return (
        <div className="canvas-page w-full max-w-full" data-component="diff-list-view" style={{ paddingBottom: "max(420px, 90vh)" }}>
            <AllModeSummary containerRef={summaryRef} />
            <div ref={rowsStartRef} />

            {paddingTop > 0 ? <div style={{ height: paddingTop }} /> : null}
            {virtualRows.map((virtualRow) => {
                const entry = allModeDiffEntries[virtualRow.index];
                if (!entry) return null;
                const { fileDiff, filePath } = entry;
                const unresolvedCount = (threadsByPath.get(filePath) ?? []).filter(
                    (thread) => !thread.root.comment.resolution && !thread.root.comment.deleted,
                ).length;
                const isCollapsed = collapsedAllModeFiles[filePath] ?? (collapseViewedFilesByDefault && viewedFiles.has(filePath));

                return (
                    <div key={filePath} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="pb-3">
                        <div id={fileAnchorId(filePath)} className="canvas-card w-full max-w-full [overflow:clip]">
                            <ReviewFileHeader
                                filePath={filePath}
                                fileDiff={fileDiff}
                                unresolvedCount={unresolvedCount}
                                onToggleCollapsed={() => review.setFileCollapsed(filePath, !isCollapsed)}
                            />
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
                <div className="p-8 text-center text-[13px] text-muted-foreground">No files match the current search.</div>
            ) : null}
        </div>
    );
}
