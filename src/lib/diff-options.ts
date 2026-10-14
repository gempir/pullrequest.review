import type { BaseDiffOptions } from "@pierre/diffs";
import type { DiffOptions } from "@/lib/diff-options-context";

export function toLibraryOptions(opts: DiffOptions): BaseDiffOptions {
    return {
        theme: opts.theme,
        diffStyle: opts.diffStyle,
        diffIndicators: opts.diffIndicators,
        disableBackground: opts.disableBackground,
        hunkSeparators: opts.hunkSeparators,
        expandUnchanged: opts.expandUnchanged,
        expansionLineCount: opts.expansionLineCount,
        lineDiffType: opts.lineDiffType,
        disableLineNumbers: opts.disableLineNumbers,
        overflow: opts.overflow,
    };
}
