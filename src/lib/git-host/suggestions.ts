import { type FileDiffMetadata, parseDiffFromFile } from "@pierre/diffs";
import type { GitHost } from "@/lib/git-host/types";

export type Suggestion = {
    content: string;
    inline: {
        path: string;
        to: number;
        startTo?: number;
    };
};

type BuildSuggestionsParams = {
    host: GitHost;
    path: string;
    originalContents: string;
    editedContents: string;
    language?: string;
};

const BITBUCKET_SUGGESTION_TRAILER = "\u200c";

type SuggestionInline = {
    to?: number;
    startTo?: number;
    outdated?: boolean;
};

export function formatSuggestion(replacement: string, host: GitHost) {
    const code = replacement === "" || replacement.endsWith("\n") ? replacement : `${replacement}\n`;
    const longestBacktickRun = Math.max(0, ...Array.from(code.matchAll(/`+/g), (match) => match[0].length));
    const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
    const suggestion = `${fence}suggestion\n${code}${fence}`;
    return host === "bitbucket" ? `${suggestion}\n\n${BITBUCKET_SUGGESTION_TRAILER}` : suggestion;
}

/**
 * Parses standard GitHub and Bitbucket suggestion Markdown. Comments with
 * surrounding prose deliberately fall back to normal Markdown so their
 * meaning is never hidden.
 */
export function parseSuggestionMarkdown(raw?: string) {
    if (!raw) return null;
    const match = /^(`{3,})suggestion[ \t]*\r?\n((?:[\s\S]*\r?\n)?)\1[ \t]*(?:\r?\n[\s\u200c]*)?$/.exec(raw);
    if (!match) return null;
    return match[2] ?? "";
}

/**
 * Gets the current PR source lines covered by an inline suggestion. This only
 * trusts the raw patch metadata: persisted full-file contexts are not keyed
 * by commit and could otherwise render a stale before-side.
 */
export function getSuggestionOriginalContents(inline: SuggestionInline | undefined, fileDiff?: FileDiffMetadata) {
    if (inline?.outdated || !fileDiff?.isPartial) return null;

    const start = inline?.startTo ?? inline?.to;
    const end = inline?.to;
    if (!start || !end || start > end) return null;

    const hunk = fileDiff.hunks.find((candidate) => start >= candidate.additionStart && end <= candidate.additionStart + candidate.additionCount - 1);
    if (!hunk) return null;

    const startIndex = hunk.additionLineIndex + start - hunk.additionStart;
    const sourceLines = fileDiff.additionLines.slice(startIndex, startIndex + end - start + 1);
    if (sourceLines.length !== end - start + 1) return null;
    return sourceLines.join("");
}

export function getSuggestionKey(suggestion: Suggestion) {
    return JSON.stringify([suggestion.inline.path, suggestion.inline.startTo ?? suggestion.inline.to, suggestion.inline.to, suggestion.content]);
}

/**
 * Turns a complete edited source file into suggestion comments anchored to
 * the pull request's current source lines.
 *
 * Replacements and deletions map directly to their source range. Insertions
 * borrow one neighboring source line and replace it with itself plus the
 * inserted text, giving the host a stable line on which to anchor the
 * suggestion.
 */
export function buildSuggestions({ host, path, originalContents, editedContents, language }: BuildSuggestionsParams): Suggestion[] {
    if (originalContents === editedContents) return [];

    const fileDiff = parseDiffFromFile({ name: path, contents: originalContents, lang: language }, { name: path, contents: editedContents, lang: language });
    const suggestions: Suggestion[] = [];

    for (const hunk of fileDiff.hunks) {
        for (const change of hunk.hunkContent) {
            if (change.type !== "change") continue;

            const addedContents = fileDiff.additionLines.slice(change.additionLineIndex, change.additionLineIndex + change.additions).join("");

            if (change.deletions > 0) {
                const startTo = change.deletionLineIndex + 1;
                const to = change.deletionLineIndex + change.deletions;
                suggestions.push({
                    content: formatSuggestion(addedContents, host),
                    inline: {
                        path,
                        to,
                        ...(startTo < to ? { startTo } : {}),
                    },
                });
                continue;
            }

            if (change.deletions === 0 && change.additions > 0 && fileDiff.deletionLines.length > 0) {
                const insertionIndex = change.deletionLineIndex;
                const anchorIndex = insertionIndex > 0 ? insertionIndex - 1 : 0;
                const anchorContents = fileDiff.deletionLines[anchorIndex];
                if (anchorContents === undefined) continue;

                const replacement = insertionIndex > 0 ? `${anchorContents}${addedContents}` : `${addedContents}${anchorContents}`;
                suggestions.push({
                    content: formatSuggestion(replacement, host),
                    inline: {
                        path,
                        to: anchorIndex + 1,
                    },
                });
            }
        }
    }

    return suggestions;
}
