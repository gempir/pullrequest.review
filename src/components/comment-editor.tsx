import { BoldPlugin, CodePlugin, ItalicPlugin } from "@platejs/basic-nodes/react";
import { Bold, Code2, Italic, Link as LinkIcon, List, Quote } from "lucide-react";
import type { Value } from "platejs";
import { Plate, PlateContent, useEditorSelector, usePlateEditor } from "platejs/react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useEffectEvent, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function normalizeDraftText(text: string): string {
    const normalized = text.replaceAll("\r\n", "\n");
    const lines = normalized.split("\n");
    if (lines.length < 8) return normalized;
    const shortLines = lines.filter((line) => line.length <= 1).length;
    if (shortLines / lines.length < 0.8) return normalized;
    return lines.join("");
}

function textToValue(text: string): Value {
    const normalized = normalizeDraftText(text);
    const lines = normalized.split("\n");
    if (lines.length === 0) {
        return [{ type: "p", children: [{ text: "" }] }];
    }
    return lines.map((line) => ({
        type: "p",
        children: [{ text: line }],
    }));
}

function nodeText(node: unknown): string {
    if (!node || typeof node !== "object") return "";
    if ("text" in node && typeof node.text === "string") return node.text;
    if (!("children" in node) || !Array.isArray(node.children)) return "";
    return node.children.map((child) => nodeText(child)).join("");
}

function valueToText(value: Value): string {
    return value.map((node) => nodeText(node)).join("\n");
}

function FormattingButton({
    ariaLabel,
    children,
    className,
    disabled,
    onActivate,
    pressed,
}: {
    ariaLabel: string;
    children: ReactNode;
    className: string;
    disabled?: boolean;
    onActivate: () => void;
    pressed?: boolean;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            static
            className={cn(
                "transition-[background-color,border-color,color] duration-100 ease-out motion-reduce:transition-none aria-pressed:border-input aria-pressed:bg-surface-active aria-pressed:text-accent",
                className,
            )}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onActivate}
            aria-label={ariaLabel}
            aria-pressed={pressed}
        >
            {children}
        </Button>
    );
}

function FormattingToolbar({
    buttonClassName,
    className,
    chrome,
    disabled,
    onInsertLink,
    onInsertList,
    onInsertQuote,
    onToggleBold,
    onToggleCode,
    onToggleItalic,
}: {
    buttonClassName: string;
    className?: string;
    chrome: "full" | "toolbar";
    disabled?: boolean;
    onInsertLink: () => void;
    onInsertList: () => void;
    onInsertQuote: () => void;
    onToggleBold: () => void;
    onToggleCode: () => void;
    onToggleItalic: () => void;
}) {
    const boldPressed = useEditorSelector((currentEditor) => Boolean(currentEditor.api.marks()?.bold), []);
    const italicPressed = useEditorSelector((currentEditor) => Boolean(currentEditor.api.marks()?.italic), []);
    const codePressed = useEditorSelector((currentEditor) => Boolean(currentEditor.api.marks()?.code), []);

    return (
        <fieldset
            className={cn(
                "m-0 flex min-w-0 items-center border-comment-border bg-comment-muted",
                chrome === "full" ? "gap-1 rounded-t-md border-x border-t px-1.5 py-1" : "gap-0.5 border-b border-surface-hover bg-transparent px-0 py-0.5",
                className,
            )}
        >
            <legend className="sr-only">Formatting options</legend>
            <FormattingButton ariaLabel="Bold" className={buttonClassName} disabled={disabled} onActivate={onToggleBold} pressed={boldPressed}>
                <Bold className="size-3.5" />
            </FormattingButton>
            <FormattingButton ariaLabel="Italic" className={buttonClassName} disabled={disabled} onActivate={onToggleItalic} pressed={italicPressed}>
                <Italic className="size-3.5" />
            </FormattingButton>
            <FormattingButton ariaLabel="Insert link" className={buttonClassName} disabled={disabled} onActivate={onInsertLink}>
                <LinkIcon className="size-3.5" />
            </FormattingButton>
            <FormattingButton ariaLabel="Code" className={buttonClassName} disabled={disabled} onActivate={onToggleCode} pressed={codePressed}>
                <Code2 className="size-3.5" />
            </FormattingButton>
            <FormattingButton ariaLabel="Insert quote" className={buttonClassName} disabled={disabled} onActivate={onInsertQuote}>
                <Quote className="size-3.5" />
            </FormattingButton>
            <FormattingButton ariaLabel="Insert list" className={buttonClassName} disabled={disabled} onActivate={onInsertList}>
                <List className="size-3.5" />
            </FormattingButton>
        </fieldset>
    );
}

export function CommentEditor({
    value,
    placeholder,
    ariaLabel = "Comment",
    disabled,
    onChange,
    onSubmit,
    onReady,
    toolbarClassName,
    contentClassName,
    contentStyle,
    chrome = "full",
}: {
    value: string;
    placeholder: string;
    ariaLabel?: string;
    disabled?: boolean;
    onChange: (next: string) => void;
    onSubmit: () => void;
    onReady?: (focus: () => void) => void;
    toolbarClassName?: string;
    contentClassName?: string;
    contentStyle?: CSSProperties;
    chrome?: "full" | "toolbar";
}) {
    const initialValue = useMemo(() => textToValue(value), [value]);
    const editor = usePlateEditor({
        plugins: [BoldPlugin, ItalicPlugin, CodePlugin],
        value: initialValue,
    });
    const notifyReady = useEffectEvent((focus: () => void) => {
        onReady?.(focus);
    });

    useEffect(() => {
        const current = valueToText(editor.children as Value);
        if (current === value) return;
        editor.tf.setValue(textToValue(value));
    }, [editor, value]);

    useEffect(() => {
        notifyReady(() => {
            editor.tf.focus({ edge: "endEditor" });
        });
    }, [editor]);

    const toolbarButtonClassName = chrome === "full" ? "h-7 rounded-[2px] px-2" : "size-6 rounded-[2px] p-0";

    return (
        <div className={cn("group/editor flex flex-col", chrome === "full" && "rounded-md bg-comment")}>
            <Plate editor={editor} onChange={({ value: nextValue }) => onChange(valueToText(nextValue))}>
                <FormattingToolbar
                    buttonClassName={toolbarButtonClassName}
                    className={toolbarClassName}
                    chrome={chrome}
                    disabled={disabled}
                    onToggleBold={() => editor.tf.bold.toggle()}
                    onToggleItalic={() => editor.tf.italic.toggle()}
                    onInsertLink={() => editor.tf.insertText("[link text](https://)")}
                    onToggleCode={() => editor.tf.code.toggle()}
                    onInsertQuote={() => editor.tf.insertText("> quote")}
                    onInsertList={() => editor.tf.insertText("- item")}
                />

                <div
                    className={cn(
                        "transition-[border-color] duration-100 ease-out motion-reduce:transition-none",
                        chrome === "full" ? "rounded-b-md border border-comment-border bg-comment group-focus-within/editor:border-input" : "bg-transparent",
                    )}
                >
                    <PlateContent
                        aria-label={ariaLabel}
                        readOnly={disabled}
                        placeholder={placeholder}
                        style={{ fontFamily: "var(--comment-font-family)", minHeight: "3.75rem", ...contentStyle }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                event.preventDefault();
                                onSubmit();
                            }
                        }}
                        className={cn(
                            "block w-full overflow-y-auto text-[13px] leading-5 placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring whitespace-pre-wrap break-words [&_p]:m-0",
                            chrome === "full" ? "px-3 py-2" : "p-0",
                            contentClassName,
                        )}
                    />
                </div>
            </Plate>
        </div>
    );
}
