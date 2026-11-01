type Selection = { value: string; start: number; end: number };
type Edit = { text: string; cursorStart: number; cursorEnd: number };

function wrapSelection({ value, start, end }: Selection, before: string, after: string, placeholder: string): Edit {
    const selected = value.slice(start, end) || placeholder;
    return {
        text: `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`,
        cursorStart: start + before.length,
        cursorEnd: start + before.length + selected.length,
    };
}

function prefixSelectedLines({ value, start, end }: Selection, prefix: string, placeholder: string): Edit {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const selected = value.slice(lineStart, end) || placeholder;
    const prefixed = selected
        .split("\n")
        .map((line) => `${prefix}${line}`)
        .join("\n");
    return {
        text: `${value.slice(0, lineStart)}${prefixed}${value.slice(end)}`,
        cursorStart: lineStart + prefix.length,
        cursorEnd: lineStart + prefixed.length,
    };
}

export const COMMENT_MARKDOWN_ACTIONS = {
    bold: (selection: Selection) => wrapSelection(selection, "**", "**", "bold text"),
    italic: (selection: Selection) => wrapSelection(selection, "_", "_", "italic text"),
    code: (selection: Selection) => wrapSelection(selection, "`", "`", "code"),
    link: (selection: Selection) => wrapSelection(selection, "[", "](https://)", "link text"),
    quote: (selection: Selection) => prefixSelectedLines(selection, "> ", "quote"),
    list: (selection: Selection) => prefixSelectedLines(selection, "- ", "item"),
    suggestion: (selection: Selection) => wrapSelection(selection, "```suggestion\n", "\n```", "replacement code"),
};
