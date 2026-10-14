import type { FileDiffOptions } from "@pierre/diffs";
import { Editor, type EditorOptions, type EditorType } from "@pierre/diffs/edit";
import { EditProvider, FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { Check, CheckCheck, Copy, LoaderCircle, PencilLine, Send, X } from "lucide-react";
import { type CSSProperties, type ReactNode, useMemo } from "react";
import { PullRequestSummaryPanel } from "@/components/pr-summary-panel";
import { DiffContextButton, type DiffContextState } from "@/components/pull-request-review/diff-context-button";
import { FileVersionSelect, type FileVersionSelectOption } from "@/components/pull-request-review/file-version-select";
import { InlineDiffAnnotation } from "@/components/pull-request-review/inline-diff-annotation";
import { ReviewDiffSettingsMenu } from "@/components/pull-request-review/review-diff-settings-menu";
import { ThreadCard } from "@/components/pull-request-review/review-thread-card";
import { RepositoryFileIcon } from "@/components/repository-file-icon";
import { Button } from "@/components/ui/button";
import { fileAnchorId } from "@/lib/file-anchors";
import type { PullRequestBundle } from "@/lib/git-host/types";
import { PR_SUMMARY_NAME, PR_SUMMARY_PATH } from "@/lib/pr-summary";
import type { SingleFileAnnotation, SingleFileAnnotationMetadata } from "./review-page-model";
import type { CommentThread } from "./review-threads";
import type { InlineCommentDraft } from "./use-inline-comment-drafts";

const EMPTY_FILE_ANNOTATIONS: SingleFileAnnotation[] = [];

function createSuggestionEditor<EType extends EditorType>(
    editorType: EType,
    options: EditorOptions<EType, SingleFileAnnotationMetadata | undefined, undefined>,
    editStateKey?: string,
) {
    return new Editor(editorType, options, editStateKey);
}

function resolveSingleDiffOptions(options: FileDiffOptions<SingleFileAnnotationMetadata | undefined, undefined>, hasFullContext: boolean) {
    if (!hasFullContext || typeof options.hunkSeparators === "function" || options.hunkSeparators === "line-info") return options;
    return { ...options, hunkSeparators: "line-info" as const };
}

function getSingleDiffRenderKey(path: string | undefined, versionId: string | undefined, historical: boolean, hasFullContext: boolean) {
    const version = versionId ?? "latest";
    const context = hasFullContext ? "full-context" : "patch-context";
    const source = historical ? "historical" : "current";
    return `${path}:${version}:${source}:${context}`;
}

type ReviewSingleModeViewProps = {
    linkedCommentId?: number;
    viewMode: "single" | "all";
    allowNestedReplies: boolean;
    onWorkspaceModeChange: (mode: "single" | "all") => void;
    prData: PullRequestBundle;
    pullRequestTitle?: string;
    currentUserDisplayName?: string;
    lineStats: { added: number; removed: number };
    isSummarySelected: boolean;
    selectedFilePath?: string;
    selectedFileDiff?: FileDiffMetadata;
    selectedFileReadOnlyHistorical: boolean;
    selectedFileVersionId?: string;
    selectedFileVersionOptions: FileVersionSelectOption[];
    copiedPath: string | null;
    fileLineStats: Map<string, { added: number; removed: number }>;
    diffHighlighterReady: boolean;
    diffTypographyStyle: CSSProperties;
    singleFileDiffOptions: FileDiffOptions<SingleFileAnnotationMetadata | undefined, undefined>;
    singleFileAnnotations: SingleFileAnnotation[];
    selectedFileLevelThreads: CommentThread[];
    workspace: string;
    repo: string;
    pullRequestId: string;
    createCommentPending: boolean;
    canCommentInline: boolean;
    canSuggestChanges: boolean;
    isSuggestionEditActive: boolean;
    isPreparingSuggestionEdit: boolean;
    suggestionCount: number;
    suggestionSubmitPending: boolean;
    editableFileDiff?: FileDiffMetadata;
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    deleteCommentPending: boolean;
    updateCommentPending: boolean;
    updateDescriptionPending: boolean;
    canEditDescription: boolean;
    toRenderableFileDiff: (fileDiff: FileDiffMetadata) => FileDiffMetadata;
    onCopyPath: (path: string) => void;
    areAllFilesViewed: boolean;
    onToggleAllFilesViewed: () => void;
    onToggleViewed: (path: string) => void;
    onSelectFileVersion: (versionId: string) => void;
    onFileVersionMenuOpen: () => void;
    getInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => string;
    setInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">, content: string) => void;
    onSubmitInlineComment: () => Promise<unknown> | undefined;
    onStartSuggestionEdit: () => void;
    onCancelSuggestionEdit: () => void;
    onSuggestionEditChange: (editedContents: string) => void;
    onSubmitSuggestions: () => Promise<unknown> | undefined;
    onInlineDraftReady: (focus: () => void) => void;
    onCancelInlineDraft: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => void;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
    onReplyToThread: (commentId: number, content: string) => Promise<unknown> | undefined;
    onEditComment: (commentId: number, content: string, hasInlineContext: boolean) => Promise<unknown> | undefined;
    onEditDescription: (description: string) => Promise<unknown> | undefined;
    onOpenDiffSettings: () => void;
    onLoadFullFileContext: (path: string, fileDiff: FileDiffMetadata) => void;
    fileContextState: Record<string, DiffContextState>;
    onHistoryCommentNavigate: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
    summaryFooter?: ReactNode;
};

function SuggestionEditControls({
    canSuggestChanges,
    isSuggestionEditing,
    isPreparingSuggestionEdit,
    suggestionCount,
    suggestionSubmitPending,
    onCancelSuggestionEdit,
    onSubmitSuggestions,
    onStartSuggestionEdit,
}: Pick<
    ReviewSingleModeViewProps,
    | "canSuggestChanges"
    | "isPreparingSuggestionEdit"
    | "suggestionCount"
    | "suggestionSubmitPending"
    | "onCancelSuggestionEdit"
    | "onSubmitSuggestions"
    | "onStartSuggestionEdit"
> & { isSuggestionEditing: boolean }) {
    if (!canSuggestChanges && !isSuggestionEditing && !isPreparingSuggestionEdit) return null;
    if (isSuggestionEditing) {
        return (
            <>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    onClick={onCancelSuggestionEdit}
                    disabled={suggestionSubmitPending}
                    title="Discard this local edit session"
                >
                    <X className="size-3.5" />
                    Cancel
                </Button>
                <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => {
                        void onSubmitSuggestions();
                    }}
                    disabled={suggestionSubmitPending || suggestionCount === 0}
                    title={
                        suggestionCount > 0
                            ? `Create ${suggestionCount} suggestion${suggestionCount === 1 ? "" : "s"}`
                            : "Replace, insert, or delete source lines to create a suggestion"
                    }
                >
                    {suggestionSubmitPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    {suggestionCount > 0 ? `Suggest ${suggestionCount}` : "Suggest changes"}
                </Button>
            </>
        );
    }
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={onStartSuggestionEdit}
            disabled={isPreparingSuggestionEdit}
            title="Edit this source file and turn changes into suggestions"
        >
            {isPreparingSuggestionEdit ? <LoaderCircle className="size-3.5 animate-spin" /> : <PencilLine className="size-3.5" />}
            Suggest edits
        </Button>
    );
}

function ReviewSingleSummary(props: ReviewSingleModeViewProps) {
    const {
        prData,
        pullRequestTitle,
        currentUserDisplayName,
        lineStats,
        viewMode,
        onWorkspaceModeChange,
        onOpenDiffSettings,
        onToggleAllFilesViewed,
        areAllFilesViewed,
        createCommentPending,
        canCommentInline,
        canResolveThread,
        resolveCommentPending,
        deleteCommentPending,
        updateCommentPending,
        updateDescriptionPending,
        canEditDescription,
        onDeleteComment,
        onResolveThread,
        onReplyToThread,
        onEditComment,
        onEditDescription,
        onHistoryCommentNavigate,
        summaryFooter,
    } = props;
    return (
        <div
            id={fileAnchorId(PR_SUMMARY_PATH)}
            data-component="summary-page"
            className="diff-content-scroll h-full w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden"
        >
            <PullRequestSummaryPanel
                bundle={prData}
                headerTitle={pullRequestTitle || PR_SUMMARY_NAME}
                diffStats={lineStats}
                currentUserDisplayName={currentUserDisplayName}
                onSelectComment={onHistoryCommentNavigate}
                createCommentPending={createCommentPending}
                canCommentInline={canCommentInline}
                canResolveThread={canResolveThread}
                resolveCommentPending={resolveCommentPending}
                deleteCommentPending={deleteCommentPending}
                updateCommentPending={updateCommentPending}
                updateDescriptionPending={updateDescriptionPending}
                canEditDescription={canEditDescription}
                onDeleteComment={onDeleteComment}
                onResolveThread={onResolveThread}
                onReplyToThread={onReplyToThread}
                onEditComment={onEditComment}
                onEditDescription={onEditDescription}
                footerRight={summaryFooter}
                headerRight={
                    <div className="flex items-center gap-1">
                        <ReviewDiffSettingsMenu viewMode={viewMode} onViewModeChange={onWorkspaceModeChange} onOpenDiffSettings={onOpenDiffSettings} />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={onToggleAllFilesViewed}
                            aria-label={areAllFilesViewed ? "Unmark all files as viewed" : "Mark all files as viewed"}
                            title={areAllFilesViewed ? "Unmark all files as viewed" : "Mark all files as viewed"}
                        >
                            <span
                                className={
                                    areAllFilesViewed
                                        ? "size-4 bg-surface-1 border border-status-renamed/60 text-status-renamed flex items-center justify-center"
                                        : "size-4 bg-surface-1 border border-border text-muted-foreground flex items-center justify-center"
                                }
                            >
                                <CheckCheck className="size-3" />
                            </span>
                        </Button>
                    </div>
                }
            />
        </div>
    );
}

function ReviewSingleFileHeader({
    selectedFilePath,
    selectedFileDiff,
    copiedPath,
    onCopyPath,
    selectedFileVersionId,
    selectedFileVersionOptions,
    onSelectFileVersion,
    onFileVersionMenuOpen,
    fileContextState,
    onLoadFullFileContext,
    selectedFileReadOnlyHistorical,
    fileLineStats,
    canSuggestChanges,
    isPreparingSuggestionEdit,
    suggestionCount,
    suggestionSubmitPending,
    onCancelSuggestionEdit,
    onSubmitSuggestions,
    onStartSuggestionEdit,
    viewMode,
    onWorkspaceModeChange,
    onOpenDiffSettings,
    onToggleViewed,
    isSuggestionEditing,
    isSelectedVersionViewed,
}: ReviewSingleModeViewProps & {
    selectedFilePath: string;
    selectedFileDiff: FileDiffMetadata;
    isSuggestionEditing: boolean;
    isSelectedVersionViewed: boolean;
}) {
    return (
        <div className="h-10 min-w-0 bg-chrome px-3 flex items-center gap-2 overflow-hidden">
            <span className="size-4 flex items-center justify-center shrink-0">
                <RepositoryFileIcon fileName={selectedFilePath.split("/").pop() || selectedFilePath} className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 flex items-center gap-2">
                <span className="min-w-0 truncate font-mono text-[12px]">{selectedFilePath}</span>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => onCopyPath(selectedFilePath)}
                    aria-label="Copy file path"
                >
                    {copiedPath === selectedFilePath ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
                <FileVersionSelect
                    value={selectedFileVersionId ?? ""}
                    options={selectedFileVersionOptions}
                    onValueChange={onSelectFileVersion}
                    onOpenChange={(open) => {
                        if (!open) return;
                        onFileVersionMenuOpen();
                    }}
                    disabled={isSuggestionEditing || isPreparingSuggestionEdit}
                />
                <DiffContextButton
                    state={fileContextState[selectedFilePath]}
                    onClick={() => onLoadFullFileContext(selectedFilePath, selectedFileDiff)}
                    disabled={selectedFileReadOnlyHistorical || isSuggestionEditing}
                />
            </div>
            <div className="ml-auto flex items-center gap-2 text-[12px]">
                <span className="select-none text-status-added">+{fileLineStats.get(selectedFilePath)?.added ?? 0}</span>
                <span className="select-none text-status-removed">-{fileLineStats.get(selectedFilePath)?.removed ?? 0}</span>
                <SuggestionEditControls
                    canSuggestChanges={canSuggestChanges}
                    isSuggestionEditing={isSuggestionEditing}
                    isPreparingSuggestionEdit={isPreparingSuggestionEdit}
                    suggestionCount={suggestionCount}
                    suggestionSubmitPending={suggestionSubmitPending}
                    onCancelSuggestionEdit={onCancelSuggestionEdit}
                    onSubmitSuggestions={onSubmitSuggestions}
                    onStartSuggestionEdit={onStartSuggestionEdit}
                />
                <ReviewDiffSettingsMenu viewMode={viewMode} onViewModeChange={onWorkspaceModeChange} onOpenDiffSettings={onOpenDiffSettings} />
                <button
                    type="button"
                    className="flex items-center text-muted-foreground"
                    onClick={() => onToggleViewed(selectedFilePath)}
                    aria-label={isSelectedVersionViewed ? `Mark ${selectedFilePath} as not viewed` : `Mark ${selectedFilePath} as viewed`}
                    title={isSelectedVersionViewed ? "Mark as not viewed" : "Mark as viewed"}
                >
                    <span
                        className={
                            isSelectedVersionViewed
                                ? "size-4 bg-surface-1 border border-status-renamed/60 text-status-renamed flex items-center justify-center"
                                : "size-4 bg-surface-1 border border-border text-transparent flex items-center justify-center"
                        }
                    >
                        <Check className="size-3" />
                    </span>
                </button>
            </div>
        </div>
    );
}

function ReviewSingleFileBody({
    diffHighlighterReady,
    selectedFileDiff,
    toRenderableFileDiff,
    editableFileDiff,
    diffTypographyStyle,
    selectedFileReadOnlyHistorical,
    singleFileAnnotations,
    linkedCommentId,
    allowNestedReplies,
    workspace,
    repo,
    pullRequestId,
    createCommentPending,
    canCommentInline,
    canResolveThread,
    resolveCommentPending,
    deleteCommentPending,
    updateCommentPending,
    getInlineDraftContent,
    setInlineDraftContent,
    onSubmitInlineComment,
    onInlineDraftReady,
    onCancelInlineDraft,
    currentUserDisplayName,
    onDeleteComment,
    onResolveThread,
    onReplyToThread,
    onEditComment,
    selectedFileLevelThreads,
    isSuggestionEditing,
    singleDiffRenderKey,
    interactiveSingleFileDiffOptions,
    suggestionEditorOptions,
}: ReviewSingleModeViewProps & {
    selectedFileDiff: FileDiffMetadata;
    isSuggestionEditing: boolean;
    singleDiffRenderKey: string;
    interactiveSingleFileDiffOptions: FileDiffOptions<SingleFileAnnotationMetadata | undefined, undefined>;
    suggestionEditorOptions: EditorOptions<"file-diff", SingleFileAnnotationMetadata | undefined, undefined>;
}) {
    return (
        <>
            <div className="diff-content-scroll min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-auto">
                {diffHighlighterReady ? (
                    <EditProvider createEditor={createSuggestionEditor}>
                        <FileDiff
                            key={singleDiffRenderKey}
                            fileDiff={toRenderableFileDiff(isSuggestionEditing ? (editableFileDiff ?? selectedFileDiff) : selectedFileDiff)}
                            options={interactiveSingleFileDiffOptions}
                            editorOptions={suggestionEditorOptions}
                            edit={isSuggestionEditing}
                            className="compact-diff commentable-diff pr-diff-font"
                            style={diffTypographyStyle}
                            lineAnnotations={isSuggestionEditing || selectedFileReadOnlyHistorical ? EMPTY_FILE_ANNOTATIONS : singleFileAnnotations}
                            renderAnnotation={(annotation) => (
                                <InlineDiffAnnotation
                                    annotation={annotation as SingleFileAnnotation}
                                    linkedCommentId={linkedCommentId}
                                    allowNestedReplies={allowNestedReplies}
                                    workspace={workspace}
                                    repo={repo}
                                    pullRequestId={pullRequestId}
                                    createCommentPending={createCommentPending}
                                    canCommentInline={canCommentInline && !selectedFileReadOnlyHistorical && !isSuggestionEditing}
                                    canResolveThread={canResolveThread}
                                    resolveCommentPending={resolveCommentPending}
                                    deleteCommentPending={deleteCommentPending}
                                    updateCommentPending={updateCommentPending}
                                    getInlineDraftContent={getInlineDraftContent}
                                    setInlineDraftContent={setInlineDraftContent}
                                    onSubmitInlineComment={onSubmitInlineComment}
                                    onInlineDraftReady={onInlineDraftReady}
                                    onCancelInlineDraft={onCancelInlineDraft}
                                    currentUserDisplayName={currentUserDisplayName}
                                    onDeleteComment={onDeleteComment}
                                    onResolveThread={onResolveThread}
                                    onReplyToThread={onReplyToThread}
                                    onEditComment={onEditComment}
                                />
                            )}
                        />
                    </EditProvider>
                ) : (
                    <div className="w-full border border-border bg-card p-3 text-[12px] text-muted-foreground">Loading syntax highlighting...</div>
                )}
            </div>

            {!selectedFileReadOnlyHistorical && !isSuggestionEditing && selectedFileLevelThreads.length > 0 ? (
                <div className="border-t border-border px-3 py-2 space-y-2">
                    {selectedFileLevelThreads.map((thread) => (
                        <ThreadCard
                            key={thread.id}
                            thread={thread}
                            allowNestedReplies={allowNestedReplies}
                            canResolveThread={canResolveThread}
                            canCommentInline={canCommentInline}
                            createCommentPending={createCommentPending}
                            resolveCommentPending={resolveCommentPending}
                            deleteCommentPending={deleteCommentPending}
                            updateCommentPending={updateCommentPending}
                            currentUserDisplayName={currentUserDisplayName}
                            onDeleteComment={onDeleteComment}
                            onResolveThread={onResolveThread}
                            onReplyToThread={onReplyToThread}
                            onEditComment={onEditComment}
                        />
                    ))}
                </div>
            ) : null}
        </>
    );
}

export function ReviewSingleModeView(props: ReviewSingleModeViewProps) {
    const {
        isSummarySelected,
        selectedFilePath,
        selectedFileDiff,
        selectedFileReadOnlyHistorical,
        selectedFileVersionId,
        selectedFileVersionOptions,
        singleFileDiffOptions,
        canCommentInline,
        isSuggestionEditActive,
        editableFileDiff,
        onSuggestionEditChange,
        fileContextState,
    } = props;
    const hasFullContext = selectedFilePath ? fileContextState[selectedFilePath]?.status === "ready" : false;
    const isSelectedVersionViewed = selectedFileVersionId
        ? selectedFileVersionOptions.some((option) => option.id === selectedFileVersionId && !option.unread)
        : false;
    const resolvedFileDiffOptions = resolveSingleDiffOptions(singleFileDiffOptions, hasFullContext);
    const isSuggestionEditing = isSuggestionEditActive && editableFileDiff !== undefined;
    const canOpenInlineDraft = canCommentInline && !selectedFileReadOnlyHistorical && !isSuggestionEditing;
    const interactiveSingleFileDiffOptions = canOpenInlineDraft
        ? resolvedFileDiffOptions
        : {
              ...resolvedFileDiffOptions,
              onLineEnter: undefined,
              onLineLeave: undefined,
          };
    const singleDiffRenderKey = getSingleDiffRenderKey(selectedFilePath, selectedFileVersionId, selectedFileReadOnlyHistorical, hasFullContext);
    const suggestionEditorOptions = useMemo<EditorOptions<"file-diff", SingleFileAnnotationMetadata | undefined, undefined>>(
        () => ({
            onChange: (event) => {
                onSuggestionEditChange(event.file.contents);
            },
        }),
        [onSuggestionEditChange],
    );
    if (isSummarySelected) return <ReviewSingleSummary {...props} />;

    if (!selectedFileDiff || !selectedFilePath) {
        return <div className="border border-border bg-card p-8 text-center text-muted-foreground text-[13px]">No file selected for the current filter.</div>;
    }

    return (
        <div id={fileAnchorId(selectedFilePath)} data-component="diff-file-view" className="h-full min-w-0 max-w-full flex flex-col overflow-x-hidden">
            <ReviewSingleFileHeader
                {...props}
                selectedFilePath={selectedFilePath}
                selectedFileDiff={selectedFileDiff}
                isSuggestionEditing={isSuggestionEditing}
                isSelectedVersionViewed={isSelectedVersionViewed}
            />

            <ReviewSingleFileBody
                {...props}
                selectedFileDiff={selectedFileDiff}
                isSuggestionEditing={isSuggestionEditing}
                singleDiffRenderKey={singleDiffRenderKey}
                interactiveSingleFileDiffOptions={interactiveSingleFileDiffOptions}
                suggestionEditorOptions={suggestionEditorOptions}
            />
        </div>
    );
}
