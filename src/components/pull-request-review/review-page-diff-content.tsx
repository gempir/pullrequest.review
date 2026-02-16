import type { FileDiffOptions } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import type { CSSProperties } from "react";
import type { DiffContextState } from "@/components/pull-request-review/diff-context-button";
import { ReviewAllModeView } from "@/components/pull-request-review/review-all-mode-view";
import type { SingleFileAnnotation } from "@/components/pull-request-review/review-page-model";
import { ReviewSingleModeView } from "@/components/pull-request-review/review-single-mode-view";
import { SettingsPanelContentOnly } from "@/components/settings-menu";
import { settingsPathForTab, settingsTabFromPath } from "@/components/settings-navigation";
import type { PullRequestBundle } from "@/lib/git-host/types";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";
import type { CommentThread } from "./review-threads";
import type { InlineCommentDraft } from "./use-inline-comment-drafts";

type ReviewPageDiffContentProps = {
    showSettingsPanel: boolean;
    viewMode: "single" | "all";
    activeFile: string | undefined;
    prData: PullRequestBundle;
    pullRequestTitle?: string;
    currentUserDisplayName?: string;
    lineStats: { added: number; removed: number };
    isSummarySelected: boolean;
    selectedFilePath?: string;
    selectedFileDiff?: FileDiffMetadata;
    copiedPath: string | null;
    fileLineStats: Map<string, { added: number; removed: number }>;
    viewedFiles: Set<string>;
    areAllFilesViewed: boolean;
    diffHighlighterReady: boolean;
    diffTypographyStyle: CSSProperties;
    singleFileDiffOptions: FileDiffOptions<undefined>;
    singleFileAnnotations: SingleFileAnnotation[];
    selectedFileLevelThreads: CommentThread[];
    workspace: string;
    repo: string;
    pullRequestId: string;
    createCommentPending: boolean;
    canCommentInline: boolean;
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    toRenderableFileDiff: (fileDiff: FileDiffMetadata) => FileDiffMetadata;
    allModeDiffEntries: Array<{ filePath: string; fileDiff: FileDiffMetadata }>;
    threadsByPath: Map<string, CommentThread[]>;
    collapsedAllModeFiles: Record<string, boolean>;
    collapseViewedFilesByDefault: boolean;
    isSummaryCollapsedInAllMode: boolean;
    buildFileAnnotations: (filePath: string) => SingleFileAnnotation[];
    fileContextState: Record<string, DiffContextState>;
    onLoadFullFileContext: (path: string, fileDiff: FileDiffMetadata) => void;
    onWorkspaceModeChange: (mode: "single" | "all") => void;
    onActiveFileChange: (path: string | undefined) => void;
    onShowSettingsPanelChange: (next: boolean) => void;
    onCopyPath: (path: string) => void;
    onToggleAllFilesViewed: () => void;
    onToggleViewed: (path: string) => void;
    getInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => string;
    setInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">, content: string) => void;
    onSubmitInlineComment: () => void;
    onInlineDraftReady: (focus: () => void) => void;
    onCancelInlineDraft: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => void;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
    onReplyToThread: (commentId: number, content: string) => void;
    onToggleSummaryCollapsed: () => void;
    onToggleCollapsedFile: (path: string, next: boolean) => void;
    onOpenInlineDraftForPath: (path: string, props: Parameters<NonNullable<FileDiffOptions<undefined>["onLineClick"]>>[0]) => void;
    onDiffLineEnter: NonNullable<FileDiffOptions<undefined>["onLineEnter"]>;
    onDiffLineLeave: NonNullable<FileDiffOptions<undefined>["onLineLeave"]>;
    onHistoryCommentNavigate: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
};

export function ReviewPageDiffContent({
    showSettingsPanel,
    viewMode,
    activeFile,
    prData,
    pullRequestTitle,
    currentUserDisplayName,
    lineStats,
    isSummarySelected,
    selectedFilePath,
    selectedFileDiff,
    copiedPath,
    fileLineStats,
    viewedFiles,
    areAllFilesViewed,
    diffHighlighterReady,
    diffTypographyStyle,
    singleFileDiffOptions,
    singleFileAnnotations,
    selectedFileLevelThreads,
    workspace,
    repo,
    pullRequestId,
    createCommentPending,
    canCommentInline,
    canResolveThread,
    resolveCommentPending,
    toRenderableFileDiff,
    allModeDiffEntries,
    threadsByPath,
    collapsedAllModeFiles,
    collapseViewedFilesByDefault,
    isSummaryCollapsedInAllMode,
    buildFileAnnotations,
    fileContextState,
    onLoadFullFileContext,
    onWorkspaceModeChange,
    onActiveFileChange,
    onShowSettingsPanelChange,
    onCopyPath,
    onToggleAllFilesViewed,
    onToggleViewed,
    getInlineDraftContent,
    setInlineDraftContent,
    onSubmitInlineComment,
    onInlineDraftReady,
    onCancelInlineDraft,
    onDeleteComment,
    onResolveThread,
    onReplyToThread,
    onToggleSummaryCollapsed,
    onToggleCollapsedFile,
    onOpenInlineDraftForPath,
    onDiffLineEnter,
    onDiffLineLeave,
    onHistoryCommentNavigate,
}: ReviewPageDiffContentProps) {
    const openDiffSettings = () => {
        onActiveFileChange(settingsPathForTab("diff"));
        onShowSettingsPanelChange(true);
    };

    if (showSettingsPanel) {
        return (
            <div className="h-full min-h-0">
                <SettingsPanelContentOnly
                    workspaceMode={viewMode}
                    onWorkspaceModeChange={onWorkspaceModeChange}
                    activeTab={settingsTabFromPath(activeFile) ?? "appearance"}
                    onActiveTabChange={(tab) => {
                        onActiveFileChange(settingsPathForTab(tab));
                    }}
                    onClose={() => {
                        onShowSettingsPanelChange(false);
                        onActiveFileChange(PR_SUMMARY_PATH);
                    }}
                />
            </div>
        );
    }

    if (viewMode === "single") {
        return (
            <ReviewSingleModeView
                viewMode={viewMode}
                onWorkspaceModeChange={onWorkspaceModeChange}
                prData={prData}
                pullRequestTitle={pullRequestTitle}
                currentUserDisplayName={currentUserDisplayName}
                lineStats={lineStats}
                isSummarySelected={isSummarySelected}
                selectedFilePath={selectedFilePath}
                selectedFileDiff={selectedFileDiff}
                copiedPath={copiedPath}
                fileLineStats={fileLineStats}
                viewedFiles={viewedFiles}
                diffHighlighterReady={diffHighlighterReady}
                diffTypographyStyle={diffTypographyStyle}
                singleFileDiffOptions={singleFileDiffOptions}
                singleFileAnnotations={singleFileAnnotations}
                selectedFileLevelThreads={selectedFileLevelThreads}
                workspace={workspace}
                repo={repo}
                pullRequestId={pullRequestId}
                createCommentPending={createCommentPending}
                canCommentInline={canCommentInline}
                canResolveThread={canResolveThread}
                resolveCommentPending={resolveCommentPending}
                toRenderableFileDiff={toRenderableFileDiff}
                onCopyPath={onCopyPath}
                areAllFilesViewed={areAllFilesViewed}
                onToggleAllFilesViewed={onToggleAllFilesViewed}
                onToggleViewed={onToggleViewed}
                getInlineDraftContent={getInlineDraftContent}
                setInlineDraftContent={setInlineDraftContent}
                onSubmitInlineComment={onSubmitInlineComment}
                onInlineDraftReady={onInlineDraftReady}
                onCancelInlineDraft={onCancelInlineDraft}
                onDeleteComment={onDeleteComment}
                onResolveThread={onResolveThread}
                onReplyToThread={onReplyToThread}
                onHistoryCommentNavigate={onHistoryCommentNavigate}
                onOpenDiffSettings={openDiffSettings}
                onLoadFullFileContext={onLoadFullFileContext}
                fileContextState={fileContextState}
            />
        );
    }

    return (
        <ReviewAllModeView
            viewMode={viewMode}
            onWorkspaceModeChange={onWorkspaceModeChange}
            pullRequestTitle={pullRequestTitle || PR_SUMMARY_NAME}
            prData={prData}
            lineStats={lineStats}
            currentUserDisplayName={currentUserDisplayName}
            isSummaryCollapsedInAllMode={isSummaryCollapsedInAllMode}
            onToggleSummaryCollapsed={onToggleSummaryCollapsed}
            allModeDiffEntries={allModeDiffEntries}
            threadsByPath={threadsByPath}
            fileLineStats={fileLineStats}
            collapsedAllModeFiles={collapsedAllModeFiles}
            collapseViewedFilesByDefault={collapseViewedFilesByDefault}
            viewedFiles={viewedFiles}
            copiedPath={copiedPath}
            areAllFilesViewed={areAllFilesViewed}
            onToggleCollapsedFile={onToggleCollapsedFile}
            onToggleAllFilesViewed={onToggleAllFilesViewed}
            onCopyPath={onCopyPath}
            onToggleViewed={onToggleViewed}
            workspace={workspace}
            repo={repo}
            pullRequestId={pullRequestId}
            diffHighlighterReady={diffHighlighterReady}
            createCommentPending={createCommentPending}
            canCommentInline={canCommentInline}
            canResolveThread={canResolveThread}
            resolveCommentPending={resolveCommentPending}
            toRenderableFileDiff={toRenderableFileDiff}
            compactDiffOptions={singleFileDiffOptions}
            getInlineDraftContent={getInlineDraftContent}
            setInlineDraftContent={setInlineDraftContent}
            onSubmitInlineComment={onSubmitInlineComment}
            onInlineDraftReady={onInlineDraftReady}
            onCancelInlineDraft={onCancelInlineDraft}
            onOpenInlineDraftForPath={onOpenInlineDraftForPath}
            onDeleteComment={onDeleteComment}
            onResolveThread={onResolveThread}
            onReplyToThread={onReplyToThread}
            onHistoryCommentNavigate={onHistoryCommentNavigate}
            onDiffLineEnter={onDiffLineEnter}
            onDiffLineLeave={onDiffLineLeave}
            diffTypographyStyle={diffTypographyStyle}
            buildFileAnnotations={buildFileAnnotations}
            onOpenDiffSettings={openDiffSettings}
            onLoadFullFileContext={onLoadFullFileContext}
            fileContextState={fileContextState}
        />
    );
}
