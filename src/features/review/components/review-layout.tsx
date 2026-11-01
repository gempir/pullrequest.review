import { Loader2 } from "lucide-react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { SettingsPanelContentOnly } from "@/components/settings-menu";
import { settingsPathForTab, settingsTabFromPath } from "@/components/settings-navigation";
import { ReviewActionDock } from "@/features/review/components/review-action-dock";
import { ReviewAllModeView } from "@/features/review/components/review-all-mode-view";
import { ReviewCommentsSidebar } from "@/features/review/components/review-comments-sidebar";
import { ReviewCommitScope } from "@/features/review/components/review-commit-scope-control";
import { useReview } from "@/features/review/components/review-context";
import { ReviewFileTreeSidebar } from "@/features/review/components/review-file-tree-sidebar";
import { ReviewMergeDialog } from "@/features/review/components/review-merge-dialog";
import { ReviewOmnibar } from "@/features/review/components/review-omnibar";
import { ReviewSingleModeView } from "@/features/review/components/review-single-mode-view";
import { ReviewTopNavbar } from "@/features/review/components/review-top-navbar";

const PANEL_GUTTER = 10;

function ReviewMainContent() {
    const { showSettingsPanel, viewMode, setViewMode, activeFile, setActiveFile, closeSettings } = useReview();
    if (showSettingsPanel) {
        return (
            <SettingsPanelContentOnly
                workspaceMode={viewMode}
                onWorkspaceModeChange={setViewMode}
                activeTab={settingsTabFromPath(activeFile) ?? "appearance"}
                onActiveTabChange={(tab) => setActiveFile(settingsPathForTab(tab))}
                onClose={closeSettings}
            />
        );
    }
    return viewMode === "single" ? <ReviewSingleModeView /> : <ReviewAllModeView />;
}

function useCanvasInsets(leftWidth: number | null, rightWidth: number | null) {
    return {
        paddingLeft: leftWidth === null ? 0 : leftWidth + PANEL_GUTTER,
        paddingRight: rightWidth === null ? 0 : rightWidth + PANEL_GUTTER,
    } satisfies CSSProperties;
}

/** Keeps floating chrome centered over the part of the canvas that panels leave free. */
function CanvasChromeSlot({ position, insets, children }: { position: "top" | "bottom"; insets: CSSProperties; children: ReactNode }) {
    return (
        <div
            className="canvas-inset-transition pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4 *:pointer-events-auto"
            style={{ ...insets, [position]: "var(--panel-inset)" }}
        >
            {children}
        </div>
    );
}

export function ReviewLayout() {
    const review = useReview();
    const insets = useCanvasInsets(
        review.sidebarProps.treeCollapsed ? null : review.sidebarProps.treeWidth,
        review.comments.collapsed ? null : review.comments.width,
    );
    return (
        <div className="relative h-full min-h-0 overflow-hidden" data-resizing={review.isResizingPanel || undefined}>
            <div
                ref={review.diffScrollRef}
                data-component="diff-view"
                className="canvas-inset-transition absolute inset-0 overflow-y-auto overflow-x-hidden [scroll-padding-top:calc(var(--canvas-top)+6px)]"
                style={insets}
            >
                <ReviewMainContent />
            </div>
            <div className="scroll-edge-top canvas-inset-transition" style={insets} aria-hidden="true" />
            <div className="scroll-edge-bottom canvas-inset-transition" style={insets} aria-hidden="true" />

            <CanvasChromeSlot position="top" insets={insets}>
                <ReviewTopNavbar {...review.navbarProps} commitScopeSlot={<ReviewCommitScope {...review.commitScope} />} />
            </CanvasChromeSlot>
            {review.actionError ? (
                <div
                    className="canvas-inset-transition pointer-events-none absolute inset-x-0 top-[var(--canvas-top)] z-30 flex justify-center px-4"
                    style={insets}
                >
                    <div role="alert" className="glass pointer-events-auto rounded-full px-4 py-1.5 text-[12px] font-medium text-destructive">
                        {review.actionError}
                    </div>
                </div>
            ) : null}
            {review.showSettingsPanel ? null : (
                <CanvasChromeSlot position="bottom" insets={insets}>
                    <ReviewActionDock {...review.dockProps} />
                </CanvasChromeSlot>
            )}

            <ReviewFileTreeSidebar {...review.sidebarProps} />
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
    const insets = useCanvasInsets(sidebarProps.treeCollapsed ? null : sidebarProps.treeWidth, null);
    return (
        <div className="relative h-full min-h-0 overflow-hidden">
            <div data-component="diff-view" className="absolute inset-0 flex items-center justify-center" style={insets}>
                <div className="flex items-center gap-2.5 text-muted-foreground" role="status">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-[13px]">Loading pull request...</span>
                </div>
            </div>
            <CanvasChromeSlot position="top" insets={insets}>
                <ReviewTopNavbar {...navbarProps} loading />
            </CanvasChromeSlot>
            <ReviewFileTreeSidebar {...sidebarProps} loading />
        </div>
    );
}
