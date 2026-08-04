import { parseDiffFromFile } from "@pierre/diffs";

export type BitbucketSuggestion = {
    content: string;
    inline: {
        path: string;
        to: number;
        startTo?: number;
    };
};

type BuildBitbucketSuggestionsParams = {
    path: string;
    originalContents: string;
    editedContents: string;
    language?: string;
};

const BITBUCKET_SUGGESTION_TRAILER = "\u200c";

export function formatBitbucketSuggestion(replacement: string) {
    const code = replacement.endsWith("\n") ? replacement : `${replacement}\n`;
    const longestBacktickRun = Math.max(0, ...Array.from(code.matchAll(/`+/g), (match) => match[0].length));
    const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
    return `${fence}suggestion\n${code}${fence}\n\n${BITBUCKET_SUGGESTION_TRAILER}`;
}

export function getBitbucketSuggestionKey(suggestion: BitbucketSuggestion) {
    return JSON.stringify([suggestion.inline.path, suggestion.inline.startTo ?? suggestion.inline.to, suggestion.inline.to, suggestion.content]);
}

/**
 * Turns a complete edited source file into Bitbucket suggestion comments.
 *
 * Bitbucket applies a suggestion against the pull request's source (the
 * originalContents side), so all anchors deliberately use that file's line
 * numbers. The initial flow limits itself to replacement blocks, which have
 * a stable, apply-able inline range.
 */
export function buildBitbucketSuggestions({ path, originalContents, editedContents, language }: BuildBitbucketSuggestionsParams): BitbucketSuggestion[] {
    if (originalContents === editedContents) return [];

    const fileDiff = parseDiffFromFile({ name: path, contents: originalContents, lang: language }, { name: path, contents: editedContents, lang: language });
    const suggestions: BitbucketSuggestion[] = [];

    for (const hunk of fileDiff.hunks) {
        for (const change of hunk.hunkContent) {
            if (change.type !== "change") continue;

            const replacement = fileDiff.additionLines.slice(change.additionLineIndex, change.additionLineIndex + change.additions).join("");

            if (change.deletions > 0 && change.additions > 0) {
                const startTo = change.deletionLineIndex + 1;
                const to = change.deletionLineIndex + change.deletions;
                suggestions.push({
                    content: formatBitbucketSuggestion(replacement),
                    inline: {
                        path,
                        to,
                        ...(startTo < to ? { startTo } : {}),
                    },
                });
            }

            // Bitbucket suggestions are line replacements. A pure insertion or
            // deletion has no reliable, user-selected replacement range, so it
            // is intentionally left out of this first Bitbucket implementation.
        }
    }

    return suggestions;
}
