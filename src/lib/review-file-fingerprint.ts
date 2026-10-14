import type { FileDiffMetadata } from "@pierre/diffs/react";

function hashString(value: string) {
    let hash1 = 0x811c9dc5;
    let hash2 = 0x01000193;
    for (let i = 0; i < value.length; i += 1) {
        const char = value.charCodeAt(i);
        hash1 = Math.imul(hash1 ^ char, 0x01000193);
        hash2 = Math.imul(hash2 ^ (char + i), 0x01000193);
    }
    return `${(hash1 >>> 0).toString(16)}${(hash2 >>> 0).toString(16)}`;
}

function usableObjectId(value?: string) {
    return value && /^[0-9a-f]{7,64}$/i.test(value) && /[1-9a-f]/i.test(value) ? value.toLowerCase() : undefined;
}

export function buildFileDiffFingerprint(fileDiff: FileDiffMetadata) {
    const prevName = fileDiff.prevName && fileDiff.prevName !== fileDiff.name ? fileDiff.prevName : "";
    const newObjectId = usableObjectId(fileDiff.newObjectId);
    const deletedObjectId = fileDiff.type === "deleted" ? usableObjectId(fileDiff.prevObjectId) : undefined;

    if (newObjectId || deletedObjectId) {
        // The source blob is stable across diff context and hunk position changes.
        // For a deletion, the removed blob is the only available content identity.
        return `v2:${hashString(
            JSON.stringify({
                name: fileDiff.name,
                prevName,
                objectId: newObjectId ?? deletedObjectId,
                mode: fileDiff.mode ?? "",
                deleted: fileDiff.type === "deleted",
            }),
        )}`;
    }

    const changes = fileDiff.hunks.flatMap((hunk) =>
        hunk.hunkContent.flatMap((content) => {
            if (content.type !== "change") return [];
            return [
                ...fileDiff.deletionLines.slice(content.deletionLineIndex, content.deletionLineIndex + content.deletions).map((line) => ["-", line]),
                ...fileDiff.additionLines.slice(content.additionLineIndex, content.additionLineIndex + content.additions).map((line) => ["+", line]),
            ];
        }),
    );
    return `v2:${hashString(
        JSON.stringify({
            type: fileDiff.type,
            name: fileDiff.name,
            prevName,
            mode: fileDiff.mode ?? "",
            prevMode: fileDiff.prevMode ?? "",
            changes,
        }),
    )}`;
}
