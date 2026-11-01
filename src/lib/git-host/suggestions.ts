import type { FileDiffMetadata } from "@pierre/diffs";

const BITBUCKET_SUGGESTION_TRAILER = "\u200c";

type SuggestionInline = {
    to?: number;
    startTo?: number;
    outdated?: boolean;
};

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

/** Bitbucket only renders a suggestion comment as a suggestion when this trailer follows the fence. */
export function withBitbucketSuggestionTrailer(content: string) {
    if (parseSuggestionMarkdown(content) === null || content.includes(BITBUCKET_SUGGESTION_TRAILER)) return content;
    return `${content.trimEnd()}\n\n${BITBUCKET_SUGGESTION_TRAILER}`;
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
