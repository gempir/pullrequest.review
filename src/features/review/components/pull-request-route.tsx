import { useCallback, useState } from "react";
import { HostAuthForm } from "@/components/auth/host-auth-form";
import { PullRequestReviewPage } from "@/features/review/components/pull-request-review-page";
import type { ReviewDiffScopeSearch } from "@/features/review/model/review-diff-scope";
import { getHostCapabilities } from "@/lib/git-host/registry";
import type { GitHost } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";

export function PullRequestRoute({
    host,
    params,
    search,
    onSearchChange,
}: {
    host: GitHost;
    params: { workspace: string; repo: string; pullRequestId: string };
    search: ReviewDiffScopeSearch;
    onSearchChange: (next: ReviewDiffScopeSearch) => void;
}) {
    const { authByHost } = usePrContext();
    const [authPromptVisible, setAuthPromptVisible] = useState(false);
    const canWrite = authByHost[host];
    const canRead = canWrite || getHostCapabilities(host).publicReadSupported;
    const requireAuth = useCallback(() => setAuthPromptVisible(true), []);

    return (
        <PullRequestReviewPage
            host={host}
            {...params}
            auth={{ canRead, canWrite }}
            onRequireAuth={requireAuth}
            reviewDiffScopeSearch={search}
            onReviewDiffScopeSearchChange={onSearchChange}
            authPromptSlot={authPromptVisible || !canRead ? <HostAuthForm host={host} mode="inline" onSuccess={() => setAuthPromptVisible(false)} /> : null}
        />
    );
}
