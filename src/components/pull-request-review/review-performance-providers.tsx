import { useWorkerPool, WorkerPoolContextProvider } from "@pierre/diffs/react";
import DiffsPortableWorker from "@pierre/diffs/worker/worker-portable.js?worker";
import { type ReactNode, useEffect, useMemo } from "react";
import { useDiffOptions } from "@/lib/diff-options-context";
import { ensureLongTaskObserver, setWorkerQueueDepth } from "@/lib/review-performance/metrics";
import { ReviewComputeWorkerProvider } from "@/lib/review-performance/review-compute-worker-context";
import { ShikiAppThemeSync } from "@/lib/shiki-app-theme-sync";

const TOKENIZE_MAX_LINE_LENGTH = 4_000;

function ReviewWorkerRenderOptionsSync() {
    const { options } = useDiffOptions();
    const workerPool = useWorkerPool();

    useEffect(() => {
        if (!workerPool) return;
        void workerPool.setRenderOptions({
            theme: options.theme,
            lineDiffType: options.lineDiffType,
            tokenizeMaxLineLength: TOKENIZE_MAX_LINE_LENGTH,
        });
    }, [options.lineDiffType, options.theme, workerPool]);

    useEffect(() => {
        if (!workerPool) return;

        const updateStats = () => {
            const stats = workerPool.getStats();
            setWorkerQueueDepth(stats.queuedTasks + stats.pendingTasks);
        };

        updateStats();
        const intervalId = window.setInterval(updateStats, 250);
        return () => {
            window.clearInterval(intervalId);
        };
    }, [workerPool]);

    return null;
}

export function ReviewPerformanceProviders({ children }: { children: ReactNode }) {
    const { options } = useDiffOptions();

    const workerPoolOptions = useMemo(() => {
        const hardwareConcurrency = typeof navigator === "undefined" ? 4 : Math.max(1, navigator.hardwareConcurrency || 4);
        return {
            workerFactory: () => new DiffsPortableWorker(),
            poolSize: Math.max(2, Math.min(8, hardwareConcurrency - 1)),
        };
    }, []);

    const highlighterOptions = useMemo(
        () => ({
            theme: options.theme,
            lineDiffType: options.lineDiffType,
            tokenizeMaxLineLength: TOKENIZE_MAX_LINE_LENGTH,
            langs: ["text", "javascript"] as Array<"text" | "javascript">,
        }),
        [options.lineDiffType, options.theme],
    );

    useEffect(() => {
        ensureLongTaskObserver();
    }, []);

    return (
        <WorkerPoolContextProvider poolOptions={workerPoolOptions} highlighterOptions={highlighterOptions}>
            <ReviewComputeWorkerProvider>
                <ShikiAppThemeSync />
                <ReviewWorkerRenderOptionsSync />
                {children}
            </ReviewComputeWorkerProvider>
        </WorkerPoolContextProvider>
    );
}
