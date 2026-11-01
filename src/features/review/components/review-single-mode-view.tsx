import { RepositoryFileIcon } from "@/components/repository-file-icon";
import { DiffContextButton } from "@/features/review/components/diff-context-button";
import { PullRequestSummaryPanel } from "@/features/review/components/pr-summary-panel";
import { useReview } from "@/features/review/components/review-context";
import { ReviewDiffSettingsMenu } from "@/features/review/components/review-diff-settings-menu";
import { AllViewedToggle, CopyPathButton, ViewedToggle } from "@/features/review/components/review-file-controls";
import { ReviewFileDiff } from "@/features/review/components/review-file-diff";
import { ReviewSummaryCommentComposer } from "@/features/review/components/review-summary-comment-composer";
import { ThreadCard } from "@/features/review/components/review-thread-card";
import { fileAnchorId } from "@/lib/file-anchors";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";

export function ReviewSingleModeView() {
    const review = useReview();
    const { model, prData, pullRequestTitle, viewMode, setViewMode, openDiffSettings, fileContextState, onLoadFullFileContext } = review;
    const { isSummarySelected, selectedFilePath, selectedFileDiff, selectedFileLevelThreads, fileLineStats, lineStats } = model;

    if (isSummarySelected) {
        return (
            <div
                id={fileAnchorId(PR_SUMMARY_PATH)}
                data-component="summary-page"
                className="diff-content-scroll h-full w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden"
            >
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
        return <div className="border border-border bg-card p-8 text-center text-muted-foreground text-[13px]">No file selected for the current filter.</div>;
    }

    const stats = fileLineStats.get(selectedFilePath);
    return (
        <div id={fileAnchorId(selectedFilePath)} data-component="diff-file-view" className="h-full min-w-0 max-w-full flex flex-col overflow-x-hidden">
            <div className="h-10 min-w-0 bg-chrome px-3 flex items-center gap-2 overflow-hidden">
                <span className="size-4 flex items-center justify-center shrink-0">
                    <RepositoryFileIcon fileName={selectedFilePath.split("/").pop() || selectedFilePath} className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="min-w-0 truncate font-mono text-[12px]">{selectedFilePath}</span>
                    <CopyPathButton path={selectedFilePath} />
                    <DiffContextButton state={fileContextState[selectedFilePath]} onClick={() => onLoadFullFileContext(selectedFilePath, selectedFileDiff)} />
                </div>
                <div className="ml-auto flex items-center gap-2 text-[12px]">
                    <span className="select-none text-status-added">+{stats?.added ?? 0}</span>
                    <span className="select-none text-status-removed">-{stats?.removed ?? 0}</span>
                    <ReviewDiffSettingsMenu viewMode={viewMode} onViewModeChange={setViewMode} onOpenDiffSettings={openDiffSettings} />
                    <ViewedToggle path={selectedFilePath} />
                </div>
            </div>

            <div className="diff-content-scroll min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-auto">
                <ReviewFileDiff filePath={selectedFilePath} fileDiff={selectedFileDiff} />
            </div>

            {selectedFileLevelThreads.length > 0 ? (
                <div className="border-t border-border px-3 py-2 space-y-2">
                    {selectedFileLevelThreads.map((thread) => (
                        <ThreadCard key={thread.id} {...review.threadProps} thread={thread} allowNestedReplies={review.allowNestedReplies} />
                    ))}
                </div>
            ) : null}
        </div>
    );
}
