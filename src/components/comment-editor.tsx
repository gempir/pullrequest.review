import { Bold, Code2, Italic, Lightbulb, Link as LinkIcon, List, Quote } from "lucide-react";
import { type CSSProperties, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { COMMENT_MARKDOWN_ACTIONS } from "@/lib/comment-markdown-actions";
import { cn } from "@/lib/utils";

const TOOLBAR_ACTIONS = [
    { action: "bold", label: "Bold", Icon: Bold },
    { action: "italic", label: "Italic", Icon: Italic },
    { action: "link", label: "Link", Icon: LinkIcon },
    { action: "code", label: "Code", Icon: Code2 },
    { action: "quote", label: "Quote", Icon: Quote },
    { action: "list", label: "List", Icon: List },
    { action: "suggestion", label: "Suggest change", Icon: Lightbulb },
] as const;

export function CommentEditor({
    value,
    placeholder,
    disabled,
    onChange,
    onSubmit,
    autoFocus,
    onFocus,
    toolbarClassName,
    contentStyle,
    chrome = "full",
}: {
    value: string;
    placeholder: string;
    disabled?: boolean;
    onChange: (next: string) => void;
    onSubmit: () => void;
    /** Focuses the editor, caret at the end, when it mounts. */
    autoFocus?: boolean;
    onFocus?: () => void;
    toolbarClassName?: string;
    contentStyle?: CSSProperties;
    chrome?: "full" | "toolbar";
}) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const attachTextarea = useCallback(
        (node: HTMLTextAreaElement | null) => {
            textareaRef.current = node;
            if (!node || !autoFocus) return;
            node.focus();
            node.setSelectionRange(node.value.length, node.value.length);
        },
        [autoFocus],
    );

    const applyAction = (action: keyof typeof COMMENT_MARKDOWN_ACTIONS) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const edit = COMMENT_MARKDOWN_ACTIONS[action]({ value, start: textarea.selectionStart, end: textarea.selectionEnd });
        onChange(edit.text);
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(edit.cursorStart, edit.cursorEnd);
        });
    };

    return (
        <div className={cn("group/editor flex flex-col", chrome === "full" && "rounded-md bg-comment")}>
            <div
                className={cn(
                    "flex items-center",
                    chrome === "full"
                        ? "gap-1 rounded-t-md border-x border-t border-comment-border bg-comment-muted px-1.5 py-1"
                        : "gap-0.5 border-b border-surface-hover bg-transparent px-0 py-0.5",
                    toolbarClassName,
                )}
            >
                {TOOLBAR_ACTIONS.map(({ action, label, Icon }) => (
                    <Button
                        key={action}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={chrome === "full" ? "h-7 rounded-[2px] px-2" : "h-6 rounded-[2px] px-0.5 [&_svg]:-translate-x-0.5"}
                        disabled={disabled}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            applyAction(action);
                        }}
                        aria-label={label}
                        title={label}
                    >
                        <Icon className="size-3.5" />
                    </Button>
                ))}
            </div>
            <textarea
                ref={attachTextarea}
                value={value}
                readOnly={disabled}
                placeholder={placeholder}
                aria-label={placeholder}
                style={{ fontFamily: "var(--comment-font-family)", minHeight: "3.75rem", fieldSizing: "content", ...contentStyle } as CSSProperties}
                onChange={(event) => onChange(event.target.value)}
                onFocus={onFocus}
                onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        onSubmit();
                    }
                }}
                className={cn(
                    "block w-full resize-none overflow-y-auto text-[13px] leading-relaxed transition-colors whitespace-pre-wrap break-words placeholder:text-muted-foreground focus-visible:outline-none",
                    chrome === "full"
                        ? "rounded-b-md border border-comment-border bg-comment px-3 py-2 group-focus-within/editor:border-input"
                        : "bg-transparent p-0",
                )}
            />
        </div>
    );
}
