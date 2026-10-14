import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import type { Comment as PullRequestComment } from "@/lib/git-host/types";
import { buildFileDiffFingerprint } from "@/lib/review-file-fingerprint";
import { buildCommentThreads, type CommentThread } from "../../components/pull-request-review/review-threads";

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

function getFilePath(fileDiff: FileDiffMetadata, index: number) {
    return fileDiff.name ?? fileDiff.prevName ?? String(index);
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
    if (message?.type !== "compute-review-derived") return;

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
