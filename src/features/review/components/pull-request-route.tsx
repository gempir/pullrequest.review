import { useState } from "react";
import { HostAuthForm } from "@/components/auth/host-auth-form";
import { PullRequestReviewPage } from "@/features/review/components/pull-request-review-page";
import type { GitHost } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";
import type { ReviewDiffScopeSearch } from "@/lib/review-diff-scope";

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
    const [renderKey, setRenderKey] = useState(0);
    // GitHub public pull requests are readable without a token; writing still needs one.
    const publicRead = host === "github";

    return (
        <PullRequestReviewPage
            key={renderKey}
            host={host}
            {...params}
            auth={{ canRead: publicRead || authByHost[host], canWrite: authByHost[host] }}
            onRequireAuth={publicRead ? () => setAuthPromptVisible(true) : undefined}
            reviewDiffScopeSearch={search}
            onReviewDiffScopeSearchChange={onSearchChange}
            authPromptSlot={
                authPromptVisible ? (
                    <HostAuthForm
                        host={host}
                        mode="inline"
                        onSuccess={() => {
                            setAuthPromptVisible(false);
                            setRenderKey((prev) => prev + 1);
                        }}
                    />
                ) : null
            }
        />
    );
}
