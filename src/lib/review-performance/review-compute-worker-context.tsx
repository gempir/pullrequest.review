import type { FileDiffMetadata } from "@pierre/diffs/react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CommentThread } from "@/components/pull-request-review/review-threads";
import type { Comment as PullRequestComment } from "@/lib/git-host/types";
import ReviewComputeWorker from "@/lib/review-performance/review-compute.worker?worker";
import { LruCache } from "@/lib/utils/lru";

type ComputeReviewDerivedPayload = {
    cacheKey: string;
    diffText: string;
    comments: PullRequestComment[];
};

type ComputeReviewDerivedResult = {
    fileDiffs: FileDiffMetadata[];
    fileDiffFingerprints: Map<string, string>;
    threads: CommentThread[];
};

type WorkerRequest = {
    type: "compute-review-derived";
    requestId: number;
    diffText: string;
    comments: PullRequestComment[];
};

type WorkerSuccessResponse = {
    type: "compute-review-derived:success";
    requestId: number;
    fileDiffs: FileDiffMetadata[];
    fileDiffFingerprints: Array<[string, string]>;
    threads: CommentThread[];
};

type WorkerErrorResponse = {
    type: "compute-review-derived:error";
    requestId: number;
    error: string;
};

type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

type PendingRequest = {
    cacheKey: string;
    resolve: (value: ComputeReviewDerivedResult) => void;
    reject: (error: Error) => void;
};

type ReviewComputeWorkerContextValue = {
    computeReviewDerived: (payload: ComputeReviewDerivedPayload) => Promise<ComputeReviewDerivedResult>;
    workerReady: boolean;
};

const ReviewComputeWorkerContext = createContext<ReviewComputeWorkerContextValue | null>(null);

export function ReviewComputeWorkerProvider({ children }: { children: ReactNode }) {
    const [workerReady, setWorkerReady] = useState(false);
    const workerRef = useRef<Worker | null>(null);
    const nextRequestIdRef = useRef(1);
    const pendingRequestsRef = useRef(new Map<number, PendingRequest>());
    const cacheRef = useRef(new LruCache<string, ComputeReviewDerivedResult>(40));

    useEffect(() => {
        if (typeof window === "undefined") return;

        const worker = new ReviewComputeWorker();
        workerRef.current = worker;
        setWorkerReady(true);

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const message = event.data;
            const pending = pendingRequestsRef.current.get(message.requestId);
            if (!pending) return;
            pendingRequestsRef.current.delete(message.requestId);

            if (message.type === "compute-review-derived:error") {
                pending.reject(new Error(message.error));
                return;
            }

            const result: ComputeReviewDerivedResult = {
                fileDiffs: message.fileDiffs,
                fileDiffFingerprints: new Map(message.fileDiffFingerprints),
                threads: message.threads,
            };
            cacheRef.current.set(pending.cacheKey, result);
            pending.resolve(result);
        };

        worker.onerror = (event) => {
            const reason = event?.message || "Review compute worker failed.";
            for (const pending of pendingRequestsRef.current.values()) {
                pending.reject(new Error(reason));
            }
            pendingRequestsRef.current.clear();
        };

        return () => {
            for (const pending of pendingRequestsRef.current.values()) {
                pending.reject(new Error("Review compute worker terminated."));
            }
            pendingRequestsRef.current.clear();
            worker.terminate();
            workerRef.current = null;
        };
    }, []);

    const computeReviewDerived = useCallback((payload: ComputeReviewDerivedPayload) => {
        const cached = cacheRef.current.get(payload.cacheKey);
        if (cached) {
            return Promise.resolve(cached);
        }

        const worker = workerRef.current;
        if (!worker) {
            return Promise.reject(new Error("Review compute worker is unavailable."));
        }

        const requestId = nextRequestIdRef.current;
        nextRequestIdRef.current += 1;

        return new Promise<ComputeReviewDerivedResult>((resolve, reject) => {
            pendingRequestsRef.current.set(requestId, {
                cacheKey: payload.cacheKey,
                resolve,
                reject,
            });

            const request: WorkerRequest = {
                type: "compute-review-derived",
                requestId,
                diffText: payload.diffText,
                comments: payload.comments,
            };
            worker.postMessage(request);
        });
    }, []);

    const value = useMemo(
        () => ({
            computeReviewDerived,
            workerReady,
        }),
        [computeReviewDerived, workerReady],
    );

    return <ReviewComputeWorkerContext.Provider value={value}>{children}</ReviewComputeWorkerContext.Provider>;
}

export function useReviewComputeWorker() {
    const context = useContext(ReviewComputeWorkerContext);
    if (!context) {
        throw new Error("useReviewComputeWorker must be used within ReviewComputeWorkerProvider");
    }
    return context;
}
