import { MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { formatDate } from "@/components/pull-request-review/review-formatters";
import type { CommentThread } from "@/components/pull-request-review/review-threads";
import { Button } from "@/components/ui/button";

function CommentMarkdown({ text }: { text: string }) {
    return (
        <div className="text-[13px] leading-relaxed">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                    a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="underline text-foreground" />,
                    p: ({ node: _node, ...props }) => <p {...props} className="whitespace-pre-wrap break-words" />,
                    ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc pl-5 space-y-1" />,
                    ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal pl-5 space-y-1" />,
                    table: ({ node: _node, ...props }) => <table {...props} className="w-full border-collapse" />,
                    th: ({ node: _node, ...props }) => <th {...props} className="border border-border p-2 text-left" />,
                    td: ({ node: _node, ...props }) => <td {...props} className="border border-border p-2" />,
                    blockquote: ({ node: _node, ...props }) => <blockquote {...props} className="border-l border-border pl-3 text-muted-foreground" />,
                    code: ({ node: _node, ...props }) => <code {...props} className="rounded bg-secondary px-1 py-0.5 text-[11px]" />,
                    pre: ({ node: _node, ...props }) => (
                        <pre {...props} className="overflow-x-auto rounded border border-border bg-background p-2 text-[11px]" />
                    ),
                    img: ({ node: _node, ...props }) => <img {...props} className="inline align-middle" alt={props.alt ?? ""} />,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}

type ThreadCardProps = {
    thread: CommentThread;
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    onResolveThread: (commentId: number, resolve: boolean) => void;
};

export function ThreadCard({ thread, canResolveThread, resolveCommentPending, onResolveThread }: ThreadCardProps) {
    return (
        <div className="border border-border bg-background p-2 text-[12px]">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MessageSquare className="size-3.5" />
                <span>{thread.root.user?.displayName ?? "Unknown"}</span>
                <span>{formatDate(thread.root.createdAt)}</span>
                <span className="ml-auto">{thread.root.resolution ? "Resolved" : "Unresolved"}</span>
            </div>
            <CommentMarkdown text={thread.root.content?.html ?? thread.root.content?.raw ?? ""} />
            {thread.replies.length > 0 ? (
                <div className="mt-2 pl-3 border-l border-border space-y-1">
                    {thread.replies.map((reply) => (
                        <div key={reply.id} className="text-[12px]">
                            <span className="text-muted-foreground">{reply.user?.displayName ?? "Unknown"}:</span>
                            <CommentMarkdown text={reply.content?.html ?? reply.content?.raw ?? ""} />
                        </div>
                    ))}
                </div>
            ) : null}
            <div className="mt-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={resolveCommentPending || !canResolveThread}
                    onClick={() => onResolveThread(thread.root.id, !thread.root.resolution)}
                >
                    {thread.root.resolution ? "Unresolve" : "Resolve"}
                </Button>
            </div>
        </div>
    );
}
