import { type FileDiffOptions, parseDiffFromFile } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useMemo } from "react";
import { useDiffOptions } from "@/lib/diff-options-context";

const SUGGESTION_PREVIEW_LANGUAGE = "text";

export function SuggestionDiffPreview({
    path,
    originalContents,
    replacementContents,
}: {
    path: string;
    originalContents: string;
    replacementContents: string;
}) {
    const { options } = useDiffOptions();
    const previewOptions = useMemo<FileDiffOptions<undefined>>(
        () => ({
            theme: options.theme,
            diffStyle: "unified",
            diffIndicators: "classic",
            disableBackground: false,
            disableFileHeader: true,
            disableLineNumbers: true,
            hunkSeparators: "simple",
            lineDiffType: "word",
            overflow: "wrap",
            lineHoverHighlight: "disabled",
            disableVirtualizationBuffers: true,
        }),
        [options.theme],
    );
    const fileDiff = useMemo(() => {
        if (originalContents === replacementContents) return null;
        return parseDiffFromFile(
            { name: path, contents: originalContents, lang: SUGGESTION_PREVIEW_LANGUAGE },
            { name: path, contents: replacementContents, lang: SUGGESTION_PREVIEW_LANGUAGE },
        );
    }, [originalContents, path, replacementContents]);

    if (!fileDiff) return null;

    return (
        <div data-component="suggestion-diff-preview" className="mt-2 overflow-hidden rounded border border-comment-border">
            <FileDiff fileDiff={fileDiff} options={previewOptions} disableWorkerPool className="compact-diff pr-diff-font" />
        </div>
    );
}
