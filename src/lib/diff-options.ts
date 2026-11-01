import type { BaseDiffOptions } from "@pierre/diffs";
import type { DiffOptions } from "@/lib/diff-options-context";

export const DIFF_LINE_TYPE = "word" as const;

export function toLibraryOptions(opts: DiffOptions) {
    return {
        theme: opts.theme,
        diffStyle: opts.diffStyle,
        diffIndicators: "none" as const,
        hunkSeparators: "simple" as const,
        expandUnchanged: opts.expandUnchanged,
        expansionLineCount: opts.expansionLineCount,
        lineDiffType: DIFF_LINE_TYPE,
        overflow: opts.overflow,
    } satisfies BaseDiffOptions;
}
