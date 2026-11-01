import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { SettingsPanelContentOnly } from "@/components/settings-menu";
import { settingsPathForTab, settingsTabFromPath } from "@/components/settings-navigation";
import { ReviewAllModeView } from "@/features/review/components/review-all-mode-view";
import { ReviewCommentsSidebar } from "@/features/review/components/review-comments-sidebar";
import { ReviewCommitScope } from "@/features/review/components/review-commit-scope-control";
import { useReview } from "@/features/review/components/review-context";
import { ReviewFileTreeSidebar } from "@/features/review/components/review-file-tree-sidebar";
import { ReviewMergeDialog } from "@/features/review/components/review-merge-dialog";
import { ReviewOmnibar } from "@/features/review/components/review-omnibar";
import { ReviewSingleModeView } from "@/features/review/components/review-single-mode-view";
import { ReviewTopNavbar } from "@/features/review/components/review-top-navbar";

function ReviewMainContent() {
    const { showSettingsPanel, viewMode, setViewMode, activeFile, setActiveFile, closeSettings } = useReview();
    if (showSettingsPanel) {
        return (
            <div className="h-full min-h-0">
                <SettingsPanelContentOnly
                    workspaceMode={viewMode}
                    onWorkspaceModeChange={setViewMode}
                    activeTab={settingsTabFromPath(activeFile) ?? "appearance"}
                    onActiveTabChange={(tab) => setActiveFile(settingsPathForTab(tab))}
                    onClose={closeSettings}
                />
            </div>
        );
    }
    return viewMode === "single" ? <ReviewSingleModeView /> : <ReviewAllModeView />;
}

export function ReviewLayout() {
    const review = useReview();
    return (
        <div className="h-full min-h-0 flex bg-background">
            <ReviewFileTreeSidebar {...review.sidebarProps} />

            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                <ReviewTopNavbar {...review.navbarProps} commitScopeSlot={<ReviewCommitScope {...review.commitScope} />} />

                {review.actionError ? (
                    <div className="border-b border-destructive bg-destructive/10 text-destructive px-3 py-1.5 text-[12px]">{review.actionError}</div>
                ) : null}

                <div ref={review.diffScrollRef} data-component="diff-view" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                    <ReviewMainContent />
                </div>
            </div>

            <ReviewCommentsSidebar {...review.comments} />
            <ReviewOmnibar {...review.omnibarProps} />
            <ReviewMergeDialog {...review.mergeDialogProps} />
        </div>
    );
}

export function ReviewLoadingLayout({
    sidebarProps,
    navbarProps,
}: {
    sidebarProps: ComponentProps<typeof ReviewFileTreeSidebar>;
    navbarProps: ComponentProps<typeof ReviewTopNavbar>;
}) {
    return (
        <div className="h-full min-h-0 flex bg-background">
            <ReviewFileTreeSidebar {...sidebarProps} loading />
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                <ReviewTopNavbar {...navbarProps} loading />
                <div data-component="diff-view" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                    <div className="h-full flex items-center justify-center p-8">
                        <div className="flex items-center gap-3 text-muted-foreground">
                            <Loader2 className="size-5 animate-spin" />
                            <span className="text-[13px]">Loading pull request...</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
