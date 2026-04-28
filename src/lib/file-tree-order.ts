type FileTreeSortLikeEntry = {
    path: string;
    segments: readonly string[];
    isDirectory: boolean;
};

function compareNaturalText(left: string, right: string) {
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }) || left.localeCompare(right);
}

function toFileTreeSortEntry(path: string, isDirectory: boolean): FileTreeSortLikeEntry {
    return {
        path,
        segments: path.split("/").filter(Boolean),
        isDirectory,
    };
}

export function compareFileTreeSortEntries(left: FileTreeSortLikeEntry, right: FileTreeSortLikeEntry) {
    const sharedDepth = Math.min(left.segments.length, right.segments.length);
    for (let depth = 0; depth < sharedDepth; depth += 1) {
        const leftSegment = left.segments[depth];
        const rightSegment = right.segments[depth];
        if (leftSegment === rightSegment) continue;
        const leftKind = depth === left.segments.length - 1 && !left.isDirectory ? "file" : "directory";
        const rightKind = depth === right.segments.length - 1 && !right.isDirectory ? "file" : "directory";
        if (leftKind !== rightKind) return leftKind === "directory" ? -1 : 1;
        return compareNaturalText(leftSegment, rightSegment);
    }
    if (left.segments.length !== right.segments.length) return left.segments.length < right.segments.length ? -1 : 1;
    if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1;
    return 0;
}

export function orderFileTreePaths(paths: readonly string[], pinnedFirstPath?: string) {
    return [...paths].sort((leftPath, rightPath) => {
        if (pinnedFirstPath) {
            if (leftPath === pinnedFirstPath && rightPath !== pinnedFirstPath) return -1;
            if (rightPath === pinnedFirstPath && leftPath !== pinnedFirstPath) return 1;
        }
        return compareFileTreeSortEntries(toFileTreeSortEntry(leftPath, false), toFileTreeSortEntry(rightPath, false));
    });
}
