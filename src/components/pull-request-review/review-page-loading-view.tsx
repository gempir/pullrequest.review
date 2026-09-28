import { Loader2 } from "lucide-react";
import type { ComponentProps, RefObject } from "react";
import { ReviewFileTreeSidebar } from "@/components/pull-request-review/review-file-tree-sidebar";
import { ReviewTopNavbar } from "@/components/pull-request-review/review-top-navbar";

type ReviewPageLoadingViewProps = {
    workspaceRef: RefObject<HTMLDivElement | null>;
    sidebarProps: ComponentProps<typeof ReviewFileTreeSidebar>;
    navbarProps: ComponentProps<typeof ReviewTopNavbar>;
};

export function ReviewPageLoadingView({ workspaceRef, sidebarProps, navbarProps }: ReviewPageLoadingViewProps) {
    return (
        <div ref={workspaceRef} className="h-full min-h-0 flex bg-background">
            <ReviewFileTreeSidebar {...sidebarProps} loading />

            <div className="review-pane flex-1 min-w-0 min-h-0 flex flex-col">
                <ReviewTopNavbar {...navbarProps} loading />
                <main id="review-content" data-component="diff-view" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                    <div className="h-full flex items-center justify-center p-8">
                        <div className="flex items-center gap-3 text-muted-foreground">
                            <Loader2 className="size-5 animate-spin" />
                            <span role="status" className="text-[13px]">
                                Loading pull request…
                            </span>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
