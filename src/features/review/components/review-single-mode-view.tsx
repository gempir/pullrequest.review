import { PullRequestSummaryPanel } from "@/features/review/components/pr-summary-panel";
import { useReview } from "@/features/review/components/review-context";
import { ReviewDiffSettingsMenu } from "@/features/review/components/review-diff-settings-menu";
import { AllViewedToggle } from "@/features/review/components/review-file-controls";
import { ReviewFileDiff } from "@/features/review/components/review-file-diff";
import { ReviewFileHeader } from "@/features/review/components/review-file-header";
import { ReviewSummaryCommentComposer } from "@/features/review/components/review-summary-comment-composer";
import { ThreadCard } from "@/features/review/components/review-thread-card";
import { fileAnchorId } from "@/lib/file-anchors";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";

export function ReviewSingleModeView() {
    const review = useReview();
    const { model, prData, pullRequestTitle, viewMode, setViewMode, openDiffSettings } = review;
    const { isSummarySelected, selectedFilePath, selectedFileDiff, selectedFileLevelThreads, lineStats } = model;

    if (isSummarySelected) {
        return (
            <div id={fileAnchorId(PR_SUMMARY_PATH)} data-component="summary-page" className="canvas-page w-full min-w-0 max-w-full overflow-x-hidden">
                <PullRequestSummaryPanel
                    {...review.summaryProps}
                    bundle={prData}
                    headerTitle={pullRequestTitle || PR_SUMMARY_NAME}
                    diffStats={lineStats}
                    footerRight={<ReviewSummaryCommentComposer key={review.pullRequestId} {...review.summaryComposer} />}
                    headerRight={
                        <div className="flex items-center gap-1">
                            <ReviewDiffSettingsMenu viewMode={viewMode} onViewModeChange={setViewMode} onOpenDiffSettings={openDiffSettings} />
                            <AllViewedToggle />
                        </div>
                    }
                />
            </div>
        );
    }

    if (!selectedFileDiff || !selectedFilePath) {
        return <div className="canvas-page flex items-center justify-center text-[13px] text-muted-foreground">No file selected for the current filter.</div>;
    }

    return (
        <div id={fileAnchorId(selectedFilePath)} data-component="diff-file-view" className="canvas-page min-w-0 max-w-full">
            <div className="canvas-card min-w-0 [overflow:clip]">
                <ReviewFileHeader filePath={selectedFilePath} fileDiff={selectedFileDiff} />
                <div className="diff-content-scroll min-w-0 w-full max-w-full overflow-x-auto">
                    <ReviewFileDiff filePath={selectedFilePath} fileDiff={selectedFileDiff} />
                </div>
                {selectedFileLevelThreads.length > 0 ? (
                    <div className="space-y-2 border-t border-border-muted px-3 py-2">
                        {selectedFileLevelThreads.map((thread) => (
                            <ThreadCard key={thread.id} {...review.threadProps} thread={thread} allowNestedReplies={review.allowNestedReplies} />
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
