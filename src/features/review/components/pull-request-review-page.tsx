import { useWorkerPool, WorkerPoolContextProvider } from "@pierre/diffs/react";
import DiffsPortableWorker from "@pierre/diffs/worker/worker-portable.js?worker";
import { type ReactNode, useEffect, useMemo } from "react";
import { ReviewContext } from "@/features/review/components/review-context";
import { ReviewLayout, ReviewLoadingLayout } from "@/features/review/components/review-layout";
import { ReviewPageAuthRequiredState, ReviewPageErrorState } from "@/features/review/components/review-page-guards";
import { type PullRequestReviewPageProps, useReviewController } from "@/features/review/hooks/use-review-controller";
import { DIFF_LINE_TYPE } from "@/lib/diff-options";
import { useDiffOptions } from "@/lib/diff-options-context";
import { getHostLabel } from "@/lib/git-host/registry";

const TOKENIZE_MAX_LINE_LENGTH = 4_000;

function DiffWorkerThemeSync() {
    const { options } = useDiffOptions();
    const workerPool = useWorkerPool();
    useEffect(() => {
        void workerPool?.setRenderOptions({ theme: options.theme, lineDiffType: DIFF_LINE_TYPE, tokenizeMaxLineLength: TOKENIZE_MAX_LINE_LENGTH });
    }, [options.theme, workerPool]);
    return null;
}

function DiffWorkerPool({ children }: { children: ReactNode }) {
    const { options } = useDiffOptions();
    const poolOptions = useMemo(
        () => ({
            workerFactory: () => new DiffsPortableWorker(),
            poolSize: Math.max(2, Math.min(8, ((typeof navigator === "undefined" ? 4 : navigator.hardwareConcurrency) || 4) - 1)),
        }),
        [],
    );
    const highlighterOptions = useMemo(
        () => ({
            theme: options.theme,
            lineDiffType: DIFF_LINE_TYPE,
            tokenizeMaxLineLength: TOKENIZE_MAX_LINE_LENGTH,
            langs: ["text", "javascript"] as Array<"text" | "javascript">,
        }),
        [options.theme],
    );
    return (
        <WorkerPoolContextProvider poolOptions={poolOptions} highlighterOptions={highlighterOptions}>
            <DiffWorkerThemeSync />
            {children}
        </WorkerPoolContextProvider>
    );
}

function ReviewPage(props: PullRequestReviewPageProps) {
    const review = useReviewController(props);
    const { prData, prQuery, sidebarProps, navbarProps, host, auth, authPromptSlot } = review;
    const loading = <ReviewLoadingLayout sidebarProps={sidebarProps} navbarProps={navbarProps} />;

    if (prQuery.isLoading) return loading;
    if (prData) {
        return (
            // eslint-disable-next-line react-doctor/jsx-no-constructed-context-values -- The controller rebuilds this value on every render by design; all consumers render with it.
            <ReviewContext.Provider value={{ ...review, prData }}>
                <ReviewLayout />
            </ReviewContext.Provider>
        );
    }
    if (prQuery.error) {
        return (
            <ReviewPageErrorState
                message={prQuery.error instanceof Error ? prQuery.error.message : "Failed to load pull request"}
                showRateLimitHelp={prQuery.rateLimited && host === "github"}
                authPromptSlot={prQuery.rateLimited && !auth.canWrite ? authPromptSlot : undefined}
            />
        );
    }
    if (!auth.canRead && !prQuery.hostCapabilities.publicReadSupported) {
        return <ReviewPageAuthRequiredState hostLabel={getHostLabel(host)} authPromptSlot={authPromptSlot} />;
    }
    return loading;
}

export function PullRequestReviewPage(props: PullRequestReviewPageProps) {
    return (
        <DiffWorkerPool>
            <ReviewPage {...props} />
        </DiffWorkerPool>
    );
}
