import type { FileDiffMetadata } from "@pierre/diffs/react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { CommentEditor } from "@/components/comment-editor";
import { CommentMarkdown } from "@/components/comment-markdown";
import { Button } from "@/components/ui/button";
import { SuggestionDiffPreview } from "@/features/review/components/bitbucket-suggestion-diff-preview";
import { CommentShareButton } from "@/features/review/components/comment-share-button";
import { Avatar, COMMENT_PRIMARY_BUTTON_CLASS } from "@/features/review/components/comment-ui";
import { type CommentActions, isOwnComment } from "@/features/review/model/comment-actions";
import { commentAnchorId } from "@/features/review/model/file-anchors";
import { type CommentThread, type CommentThreadNode, flattenThread } from "@/features/review/model/review-threads";
import { getSuggestionOriginalContents, parseSuggestionMarkdown } from "@/lib/git-host/suggestions";
import type { Comment } from "@/lib/git-host/types";
import { commentTimestampSource, describeCommentTimestamp } from "@/lib/timestamp";

const TEXT_ACTION_CLASS =
    "text-[12px] font-semibold leading-none text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

type Editor = { kind: "reply" | "edit"; commentId: number; value: string } | null;
/** A save in flight: a reply to `commentId`, or an edit or delete of it. */
type Saving = { kind: "reply" | "edit" | "remove"; commentId: number } | null;

interface ThreadCardState {
    thread: CommentThread;
    actions: CommentActions;
    showCommentShareLinks: boolean;
    suggestionSourceFileDiff?: FileDiffMetadata;
    editor: Editor;
    setEditorValue: (value: string) => void;
    saving: Saving;
    startEditor: (kind: "reply" | "edit", comment: Comment) => void;
    cancelEditor: () => void;
    submitEditor: () => void;
    removeComment: (comment: Comment) => void;
}

const ThreadCardContext = createContext<ThreadCardState | null>(null);

function useThreadCard() {
    const state = useContext(ThreadCardContext);
    if (!state) throw new Error("useThreadCard must be used within ThreadCard");
    return state;
}

function ThreadCommentBody({ comment, isRoot }: { comment: Comment; isRoot: boolean }) {
    const { suggestionSourceFileDiff } = useThreadCard();
    const path = comment.inline?.path;
    if (isRoot && path) {
        const replacementContents = parseSuggestionMarkdown(comment.content?.raw);
        const originalContents = getSuggestionOriginalContents(comment.inline, suggestionSourceFileDiff);
        if (replacementContents !== null && originalContents !== null && originalContents !== replacementContents) {
            return <SuggestionDiffPreview path={path} originalContents={originalContents} replacementContents={replacementContents} />;
        }
    }
    return <CommentMarkdown text={comment.content?.html ?? comment.content?.raw ?? ""} variant="thread" />;
}

function EditorButtons({ reply, disabled }: { reply: boolean; disabled: boolean }) {
    const { actions, saving, submitEditor, cancelEditor } = useThreadCard();
    const pending = saving !== null || (reply ? actions.pending.create : actions.pending.update);
    return (
        <div className="mt-2 flex flex-wrap items-center gap-1">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`h-7 ${COMMENT_PRIMARY_BUTTON_CLASS}`}
                disabled={pending || disabled}
                onClick={submitEditor}
            >
                {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                {reply ? "Comment" : "Save"}
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-md border border-input bg-surface-1 gap-1.5 hover:bg-surface-hover"
                disabled={pending}
                onClick={cancelEditor}
            >
                Cancel
            </Button>
        </div>
    );
}

function CommentActionsRow({ comment, isRoot }: { comment: Comment; isRoot: boolean }) {
    const { actions, editor, startEditor, removeComment } = useThreadCard();
    if (editor?.commentId === comment.id) return <EditorButtons reply={editor.kind === "reply"} disabled={editor.kind === "reply" && !actions.canReply} />;

    const own = isOwnComment(actions, comment);
    const isResolved = Boolean(comment.resolution);
    const items = [
        { id: "reply", label: "Reply", disabled: actions.pending.create || !actions.canReply, onClick: () => startEditor("reply", comment) },
        ...(isRoot && actions.canResolve
            ? [
                  {
                      id: "resolve",
                      label: isResolved ? "Unresolve" : "Resolve",
                      disabled: actions.pending.resolve,
                      onClick: () => actions.resolve(comment, !isResolved),
                  },
              ]
            : []),
        ...(own
            ? [
                  { id: "edit", label: "Edit", disabled: actions.pending.update, onClick: () => startEditor("edit", comment) },
                  { id: "delete", label: "Delete", disabled: actions.pending.remove, onClick: () => removeComment(comment) },
              ]
            : []),
    ];
    return (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {items.map((item, index) => (
                <span key={item.id} className="inline-flex items-center gap-1.5">
                    {index > 0 ? <span className="text-muted-foreground/70">{"\u00b7"}</span> : null}
                    <button type="button" className={TEXT_ACTION_CLASS} disabled={item.disabled} onClick={item.onClick}>
                        {item.label}
                    </button>
                </span>
            ))}
        </div>
    );
}

/** The body, editors and actions shared by the root comment and its replies. */
function CommentContent({ comment, isRoot }: { comment: Comment; isRoot: boolean }) {
    const { actions, editor, setEditorValue, submitEditor, saving } = useThreadCard();
    const editing = editor?.kind === "edit" && editor.commentId === comment.id;
    const replying = editor?.kind === "reply" && editor.commentId === comment.id;
    const pending = isCommentPending(comment, editor, saving);
    return (
        <>
            {editing ? (
                <CommentEditor
                    value={editor.value}
                    placeholder="Edit comment"
                    disabled={actions.pending.update || saving !== null}
                    autoFocus
                    onChange={setEditorValue}
                    onSubmit={submitEditor}
                    chrome="toolbar"
                />
            ) : (
                <div className={pending ? "opacity-70" : undefined}>
                    <ThreadCommentBody comment={comment} isRoot={isRoot} />
                </div>
            )}
            {replying ? (
                <CommentEditor
                    value={editor.value}
                    placeholder="Reply to this thread"
                    disabled={actions.pending.create || saving !== null || !actions.canReply}
                    autoFocus
                    onChange={setEditorValue}
                    onSubmit={submitEditor}
                />
            ) : null}
            {pending ? null : <CommentActionsRow comment={comment} isRoot={isRoot} />}
        </>
    );
}

/** A comment syncs while the host has not confirmed it, or while its own edit (with the editor closed) or delete saves. */
function isCommentPending(comment: Comment, editor: Editor, saving: Saving) {
    const editingThis = editor?.kind === "edit" && editor.commentId === comment.id;
    const savingThis = saving !== null && saving.kind !== "reply" && saving.commentId === comment.id;
    return Boolean(comment.pending) || (savingThis && !editingThis);
}

function CommentHeader({ comment, isRoot, children }: { comment: Comment; isRoot: boolean; children?: ReactNode }) {
    const { thread, editor, saving, showCommentShareLinks } = useThreadCard();
    const date = describeCommentTimestamp(commentTimestampSource(comment), { unknownLabel: "" });
    const sharePath = thread.root.comment.inline?.path;
    return (
        <div
            className={
                isRoot ? "relative flex items-center gap-3 text-[13px] text-muted-foreground" : "flex items-center gap-3 text-[12px] text-muted-foreground"
            }
        >
            <span className={isRoot ? "font-semibold text-foreground text-[16px]" : "font-semibold text-foreground text-[14px]"}>
                {comment.user?.displayName ?? "Unknown"}
            </span>
            {date.label ? (
                <span className="font-semibold tabular-nums" title={date.absoluteLabel ?? undefined}>
                    {date.label}
                </span>
            ) : null}
            {showCommentShareLinks && sharePath ? <CommentShareButton path={sharePath} commentId={comment.id} /> : null}
            {isCommentPending(comment, editor, saving) ? <LoaderCircle className="size-3.5 animate-spin text-accent" aria-label="Syncing comment" /> : null}
            {children}
        </div>
    );
}

function ReplyNode({ node, depth }: { node: CommentThreadNode; depth: number }) {
    const { actions } = useThreadCard();
    const reply = node.comment;
    return (
        <div className="relative" data-thread-depth={depth} style={{ marginLeft: actions.nestedReplies ? 38 : 0 }}>
            <div id={commentAnchorId(reply.id)} className="relative z-10 flex gap-3 py-[3px] pr-4">
                <Avatar name={reply.user?.displayName ?? "Unknown"} url={reply.user?.avatarUrl} sizeClass="relative z-10 size-6" />
                <div className="relative z-10 min-w-0 flex-1">
                    <CommentHeader comment={reply} isRoot={false} />
                    <CommentContent comment={reply} isRoot={false} />
                </div>
            </div>
            {node.children.length > 0 ? (
                <div>
                    {node.children.map((child) => (
                        <ReplyNode key={child.comment.id} node={child} depth={depth + 1} />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function RootComment({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
    const { thread, editor, saving } = useThreadCard();
    const root = thread.root.comment;
    const isResolved = Boolean(root.resolution);
    return (
        <div id={commentAnchorId(root.id)} className={`group/root-card relative z-10 flex ${collapsed ? "items-center" : "items-start"} gap-4 px-4 py-2`}>
            <Avatar name={root.user?.displayName ?? "Unknown"} url={root.user?.avatarUrl} sizeClass="size-6" />
            <div className="min-w-0 flex-1">
                <CommentHeader comment={root} isRoot>
                    {isResolved && !isCommentPending(root, editor, saving) ? (
                        <button
                            type="button"
                            className="absolute left-1/2 top-1/2 inline-flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                            onClick={onToggleCollapsed}
                            aria-label={collapsed ? "Expand resolved thread" : "Collapse resolved thread"}
                        >
                            <ChevronDown className={collapsed ? "size-5 transition-transform" : "size-5 rotate-180 transition-transform"} />
                        </button>
                    ) : null}
                </CommentHeader>
                {collapsed ? null : <CommentContent comment={root} isRoot />}
            </div>
        </div>
    );
}

/** Resolved threads start collapsed unless they hold the linked comment; resolving or unresolving resets the choice. */
function useResolvedCollapse(thread: CommentThread, linkedCommentId: number | undefined) {
    const root = thread.root.comment;
    const holdsLinkedComment = linkedCommentId !== undefined && flattenThread(thread).some((comment) => comment.id === linkedCommentId);
    const defaultCollapsed = Boolean(root.resolution) && !holdsLinkedComment;
    const [override, setOverride] = useState<{ resolution: Comment["resolution"]; linkedCommentId?: number; collapsed: boolean } | null>(null);
    const overrideApplies = override !== null && override.resolution === root.resolution && override.linkedCommentId === linkedCommentId;
    const collapsed = overrideApplies ? override.collapsed : defaultCollapsed;
    return [collapsed, () => setOverride({ resolution: root.resolution, linkedCommentId, collapsed: !collapsed })] as const;
}

type ThreadCardProps = {
    thread: CommentThread;
    actions: CommentActions;
    linkedCommentId?: number;
    attachToDiffEdge?: boolean;
    showBorder?: boolean;
    header?: ReactNode;
    showCommentShareLinks?: boolean;
    suggestionSourceFileDiff?: FileDiffMetadata;
};

export function ThreadCard({
    thread,
    actions,
    linkedCommentId,
    attachToDiffEdge = true,
    showBorder = true,
    header,
    showCommentShareLinks = true,
    suggestionSourceFileDiff,
}: ThreadCardProps) {
    const root = thread.root.comment;
    const [editor, setEditor] = useState<Editor>(null);
    const [saving, setSaving] = useState<Saving>(null);
    const [collapsed, toggleCollapsed] = useResolvedCollapse(thread, linkedCommentId);

    const runSave = async (next: NonNullable<Saving>, save: () => Promise<unknown> | undefined) => {
        setSaving(next);
        try {
            await save();
            setEditor(null);
        } catch {
            // The mutation surfaces the error in the review action banner.
        } finally {
            setSaving(null);
        }
    };

    const state: ThreadCardState = {
        thread,
        actions,
        showCommentShareLinks,
        suggestionSourceFileDiff,
        editor,
        saving,
        setEditorValue: (value) => setEditor((prev) => (prev && prev.value !== value ? { ...prev, value } : prev)),
        startEditor: (kind, comment) => {
            // Finishing a save closes the editor, so none may open meanwhile.
            if (saving !== null) return;
            if (kind === "reply" && (!actions.canReply || actions.pending.create)) return;
            if (kind === "edit" && actions.pending.update) return;
            setEditor({ kind, commentId: comment.id, value: kind === "edit" ? (comment.content?.raw ?? "") : "" });
        },
        cancelEditor: () => {
            if (saving === null) setEditor(null);
        },
        submitEditor: () => {
            const content = editor?.value.trim();
            if (!editor || !content || saving !== null) return;
            if (editor.kind === "reply") {
                void runSave({ kind: "reply", commentId: editor.commentId }, () => actions.reply(actions.nestedReplies ? editor.commentId : root.id, content));
                return;
            }
            const comment = flattenThread(thread).find((candidate) => candidate.id === editor.commentId);
            if (comment) void runSave({ kind: "edit", commentId: comment.id }, () => actions.edit(comment, content));
        },
        removeComment: (comment) => {
            if (actions.pending.remove || saving !== null) return;
            setEditor(null);
            void runSave({ kind: "remove", commentId: comment.id }, () => actions.remove(comment));
        },
    };

    const shouldAttachToDiffEdge = attachToDiffEdge && Boolean(root.inline?.path);
    const cardClassName = showBorder
        ? shouldAttachToDiffEdge
            ? "relative border-y border-r border-comment-border bg-comment"
            : "relative border border-comment-border bg-comment"
        : "relative bg-comment";
    return (
        // eslint-disable-next-line react-doctor/context-provider-value-from-unmemoized-local-literal -- Rebuilt with the card each render; only the card's own subtree consumes it.
        <ThreadCardContext.Provider value={state}>
            <div className="text-[12px]" style={{ fontFamily: "var(--comment-font-family)" }}>
                <div className={cardClassName}>
                    {header ? (
                        <div className={showBorder ? "border-b border-comment-border" : ""} data-component="thread-card-header">
                            {header}
                        </div>
                    ) : null}
                    <RootComment
                        collapsed={collapsed}
                        onToggleCollapsed={() => {
                            setEditor(null);
                            toggleCollapsed();
                        }}
                    />
                    {!collapsed && thread.root.children.length > 0 ? (
                        <div className="relative z-10 px-4 pb-2 pt-2.5">
                            {thread.root.children.map((reply) => (
                                <ReplyNode key={reply.comment.id} node={reply} depth={1} />
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </ThreadCardContext.Provider>
    );
}
