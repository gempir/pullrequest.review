import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { CommentMarkdownImage } from "@/components/comment-markdown-image";
import { cn } from "@/lib/utils";

const BITBUCKET_MARKDOWN_IMAGE_ATTR_PATTERN = /(!\[[^\]\n]*\]\([^\n]*?\))\{:\s*[^}\n]*\}/g;
const BITBUCKET_HTML_IMAGE_ATTR_PATTERN = /(<img\b[^>]*>)\{:\s*[^}\n]*\}/gi;

const commentMarkdownSchema = {
    ...defaultSchema,
    attributes: {
        ...defaultSchema.attributes,
        img: [...(defaultSchema.attributes?.img ?? []), "alt", "className", "height", "loading", "src", "title", "width"],
    },
};

const markdownClassByVariant = {
    summary: "space-y-2 text-[13px] leading-relaxed",
    thread: "mt-1 text-[14px] leading-relaxed text-foreground",
    sidebar: "text-[13px] leading-relaxed text-foreground",
} as const;

type CommentMarkdownVariant = keyof typeof markdownClassByVariant;

function normalizeCommentMarkdown(text: string) {
    return text.replace(BITBUCKET_MARKDOWN_IMAGE_ATTR_PATTERN, "$1").replace(BITBUCKET_HTML_IMAGE_ATTR_PATTERN, "$1");
}

export function CommentMarkdown({ className, text, variant = "summary" }: { className?: string; text: string; variant?: CommentMarkdownVariant }) {
    return (
        <div className={cn(markdownClassByVariant[variant], className)} style={{ fontFamily: "var(--comment-font-family)" }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, [rehypeSanitize, commentMarkdownSchema]]}
                components={{
                    a: ({ node: _node, ...props }) => (
                        <a {...props} target="_blank" rel="noreferrer" className="break-all underline text-accent hover:text-accent-muted" />
                    ),
                    h1: ({ node: _node, children, ...props }) => (
                        <h1 {...props} className="text-xl font-bold">
                            {children}
                        </h1>
                    ),
                    h2: ({ node: _node, children, ...props }) => (
                        <h2 {...props} className="text-lg font-bold">
                            {children}
                        </h2>
                    ),
                    h3: ({ node: _node, children, ...props }) => (
                        <h3 {...props} className="text-base font-bold">
                            {children}
                        </h3>
                    ),
                    h4: ({ node: _node, children, ...props }) => (
                        <h4 {...props} className="text-sm font-bold">
                            {children}
                        </h4>
                    ),
                    h5: ({ node: _node, children, ...props }) => (
                        <h5 {...props} className="text-[13px] font-bold">
                            {children}
                        </h5>
                    ),
                    h6: ({ node: _node, children, ...props }) => (
                        <h6 {...props} className="text-xs font-bold">
                            {children}
                        </h6>
                    ),
                    p: ({ node: _node, ...props }) => <p {...props} className="whitespace-pre-wrap break-words" />,
                    ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc space-y-1 pl-5" />,
                    ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal space-y-1 pl-5" />,
                    table: ({ node: _node, ...props }) => <table {...props} className="w-full border-collapse" />,
                    th: ({ node: _node, ...props }) => <th {...props} className="border border-border p-2 text-left break-words" />,
                    td: ({ node: _node, ...props }) => <td {...props} className="border border-border p-2 break-words" />,
                    blockquote: ({ node: _node, ...props }) => <blockquote {...props} className="border-l-2 border-border pl-3 text-muted-foreground" />,
                    code: ({ node: _node, ...props }) => <code {...props} className="break-words rounded bg-comment-muted px-1 py-0.5 text-[11px]" />,
                    pre: ({ node: _node, ...props }) => (
                        <pre {...props} className="overflow-x-auto rounded border border-comment-border bg-comment-muted p-2 text-[11px]" />
                    ),
                    img: ({ node: _node, ...props }) => <CommentMarkdownImage {...props} />,
                }}
            >
                {normalizeCommentMarkdown(text)}
            </ReactMarkdown>
        </div>
    );
}
