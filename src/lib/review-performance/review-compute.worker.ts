import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import { buildCommentThreads, type CommentThread } from "../../components/pull-request-review/review-threads";
import type { Comment as PullRequestComment } from "@/lib/git-host/types";

type ComputeReviewDerivedRequest = {
    type: "compute-review-derived";
    requestId: number;
    diffText: string;
    comments: PullRequestComment[];
};

type ComputeReviewDerivedSuccess = {
    type: "compute-review-derived:success";
    requestId: number;
    fileDiffs: FileDiffMetadata[];
    fileDiffFingerprints: Array<[string, string]>;
    threads: CommentThread[];
};

type ComputeReviewDerivedError = {
    type: "compute-review-derived:error";
    requestId: number;
    error: string;
};

type WorkerRequest = ComputeReviewDerivedRequest;
type WorkerResponse = ComputeReviewDerivedSuccess | ComputeReviewDerivedError;

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

function getFilePath(fileDiff: FileDiffMetadata, index: number) {
    return fileDiff.name ?? fileDiff.prevName ?? String(index);
}

function buildFileDiffFingerprint(fileDiff: FileDiffMetadata) {
    const normalized = {
        type: fileDiff.type,
        name: fileDiff.name,
        prevName: fileDiff.prevName ?? "",
        hunks: (fileDiff.hunks ?? []).map((hunk) => ({
            additionCount: hunk.additionCount,
            additionLines: hunk.additionLines,
            additionStart: hunk.additionStart,
            deletionCount: hunk.deletionCount,
            deletionLines: hunk.deletionLines,
            deletionStart: hunk.deletionStart,
            unifiedLineCount: hunk.unifiedLineCount,
            unifiedLineStart: hunk.unifiedLineStart,
            splitLineCount: hunk.splitLineCount,
            splitLineStart: hunk.splitLineStart,
            hunkContext: hunk.hunkContext,
            hunkSpecs: hunk.hunkSpecs,
            hunkContent: hunk.hunkContent,
        })),
    };
    return hashString(JSON.stringify(normalized));
}

function computeReviewDerived(diffText: string, comments: PullRequestComment[]) {
    const patches = diffText ? parsePatchFiles(diffText) : [];
    const fileDiffs = patches.flatMap((patch) => patch.files);
    const fingerprintEntries = new Map<string, string>();

    fileDiffs.forEach((fileDiff, index) => {
        const path = getFilePath(fileDiff, index);
        if (!fingerprintEntries.has(path)) {
            fingerprintEntries.set(path, buildFileDiffFingerprint(fileDiff));
        }
    });

    return {
        fileDiffs,
        fileDiffFingerprints: Array.from(fingerprintEntries.entries()),
        threads: buildCommentThreads(comments),
    };
}

const workerScope = self as unknown as Worker;

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
    const message = event.data;
    if (!message || message.type !== "compute-review-derived") return;

    try {
        const result = computeReviewDerived(message.diffText, message.comments);
        const response: ComputeReviewDerivedSuccess = {
            type: "compute-review-derived:success",
            requestId: message.requestId,
            fileDiffs: result.fileDiffs,
            fileDiffFingerprints: result.fileDiffFingerprints,
            threads: result.threads,
        };
        workerScope.postMessage(response as WorkerResponse);
    } catch (error) {
        const response: ComputeReviewDerivedError = {
            type: "compute-review-derived:error",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : "Failed to compute review derived data.",
        };
        workerScope.postMessage(response as WorkerResponse);
    }
};
