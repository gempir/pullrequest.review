import { BoldPlugin, CodePlugin, ItalicPlugin } from "@platejs/basic-nodes/react";
import { Bold, Code2, Italic, Link as LinkIcon, List, Quote } from "lucide-react";
import type { Value } from "platejs";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";

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

export function CommentEditor({
    value,
    placeholder,
    disabled,
    onChange,
    onSubmit,
    onReady,
}: {
    value: string;
    placeholder: string;
    disabled?: boolean;
    onChange: (next: string) => void;
    onSubmit: () => void;
    onReady?: (focus: () => void) => void;
}) {
    const initialValue = useMemo(() => textToValue(value), [value]);
    const editor = usePlateEditor({
        plugins: [BoldPlugin, ItalicPlugin, CodePlugin],
        value: initialValue,
    });

    useEffect(() => {
        const current = valueToText(editor.children as Value);
        if (current === value) return;
        editor.tf.setValue(textToValue(value));
    }, [editor, value]);

    useEffect(() => {
        onReady?.(() => {
            editor.tf.focus({ edge: "endEditor" });
        });
    }, [editor, onReady]);

    return (
        <div className="bg-background">
            <Plate editor={editor} onChange={({ value: nextValue }) => onChange(valueToText(nextValue))}>
                <div className="flex items-center gap-1 px-1.5 py-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={disabled}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            editor.tf.bold.toggle();
                        }}
                        aria-label="Bold"
                    >
                        <Bold className="size-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={disabled}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            editor.tf.italic.toggle();
                        }}
                        aria-label="Italic"
                    >
                        <Italic className="size-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={disabled}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            editor.tf.insertText("[link text](https://)");
                        }}
                        aria-label="Link"
                    >
                        <LinkIcon className="size-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={disabled}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            editor.tf.code.toggle();
                        }}
                        aria-label="Code"
                    >
                        <Code2 className="size-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={disabled}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            editor.tf.insertText("> quote");
                        }}
                        aria-label="Quote"
                    >
                        <Quote className="size-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={disabled}
                        onMouseDown={(event) => {
                            event.preventDefault();
                            editor.tf.insertText("- item");
                        }}
                        aria-label="List"
                    >
                        <List className="size-3.5" />
                    </Button>
                </div>

                <PlateContent
                    readOnly={disabled}
                    placeholder={placeholder}
                    style={{ fontFamily: "var(--comment-font-family)" }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            event.preventDefault();
                            onSubmit();
                        }
                    }}
                    className="block h-[3.5rem] w-full overflow-y-auto px-3 py-2 text-[13px] leading-relaxed transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 whitespace-pre-wrap break-words [&_p]:m-0"
                />
            </Plate>
        </div>
    );
}
