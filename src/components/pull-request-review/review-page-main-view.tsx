import type { ComponentProps, ReactNode, RefObject } from "react";
import { ReviewFileTreeSidebar } from "@/components/pull-request-review/review-file-tree-sidebar";
import { ReviewMergeDialog } from "@/components/pull-request-review/review-merge-dialog";
import { ReviewOmnibar } from "@/components/pull-request-review/review-omnibar";
import { ReviewTopNavbar } from "@/components/pull-request-review/review-top-navbar";

type ReviewPageMainViewProps = {
    workspaceRef: RefObject<HTMLDivElement | null>;
    diffScrollRef: RefObject<HTMLDivElement | null>;
    sidebarProps: ComponentProps<typeof ReviewFileTreeSidebar>;
    navbarProps: ComponentProps<typeof ReviewTopNavbar>;
    actionError: string | null;
    diffContent: ReactNode;
    rightSidebar?: ReactNode;
    omnibarProps: ComponentProps<typeof ReviewOmnibar>;
    mergeDialogProps: ComponentProps<typeof ReviewMergeDialog>;
};

export function ReviewPageMainView({
    workspaceRef,
    diffScrollRef,
    sidebarProps,
    navbarProps,
    actionError,
    diffContent,
    rightSidebar,
    omnibarProps,
    mergeDialogProps,
}: ReviewPageMainViewProps) {
    return (
        <div ref={workspaceRef} className="h-full min-h-0 flex bg-background">
            <a href="#review-content" className="skip-review-content">
                Skip to review content
            </a>
            <ReviewFileTreeSidebar {...sidebarProps} />

            <div className="review-pane flex-1 min-w-0 min-h-0 flex flex-col">
                <ReviewTopNavbar {...navbarProps} />

                {actionError ? (
                    <div role="alert" className="border-b border-destructive bg-destructive/10 text-destructive px-3 py-1.5 text-[12px]">
                        {actionError}
                    </div>
                ) : null}

                <main
                    id="review-content"
                    ref={diffScrollRef}
                    tabIndex={-1}
                    data-component="diff-view"
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden outline-none"
                >
                    {diffContent}
                </main>
            </div>

            {rightSidebar}

            <ReviewOmnibar {...omnibarProps} />
            <ReviewMergeDialog {...mergeDialogProps} />
        </div>
    );
}
