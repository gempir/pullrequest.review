export function fileAnchorId(path: string) {
    const safe = path.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `file-${safe}`;
}

export function commentAnchorId(commentId: number) {
    return `comment-${commentId}`;
}
