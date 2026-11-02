import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HostAuthForm } from "@/components/auth/host-auth-form";
import { GitHostIcon } from "@/components/git-host-icon";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PullRequestUrlField } from "@/features/landing/components/pull-request-url-field";
import { DEFAULT_REVIEW_SCOPE_SEARCH, HOSTS, type PullRequestTarget } from "@/features/landing/model/landing-model";
import { getHostLabel } from "@/lib/git-host/registry";
import { usePrContext } from "@/lib/pr-context";

export function WelcomeScreen() {
    const navigate = useNavigate();
    const { activeHost, setActiveHost } = usePrContext();
    const [url, setUrl] = useState("");

    const openTarget = ({ host, workspace, repo, pullRequestId }: PullRequestTarget) => {
        const to = host === "github" ? "/$workspace/$repo/pull/$pullRequestId" : "/$workspace/$repo/pull-requests/$pullRequestId";
        navigate({ to, params: { workspace, repo, pullRequestId }, search: DEFAULT_REVIEW_SCOPE_SEARCH, hash: "" });
    };

    return (
        <main data-component="diff-view" className="h-dvh overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col justify-center gap-8 px-6 py-12">
                <header className="space-y-3 text-center">
                    <p className="text-[13px] font-medium text-accent">pullrequest.review</p>
                    <h1 className="display-title text-[44px]">Read every change.</h1>
                    <p className="text-[15px] text-muted-foreground">A fast, focused place to review pull requests from GitHub and Bitbucket.</p>
                </header>

                <PullRequestUrlField large autoFocus value={url} onChange={setUrl} onOpenTarget={openTarget} placeholder="Paste a pull request URL" />

                <section className="glass space-y-4 rounded-2xl p-5" aria-label="Connect a git host">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="section-title text-[15px]">Connect for your inbox</h2>
                        <SegmentedControl
                            label="Git host"
                            value={activeHost}
                            onChange={setActiveHost}
                            options={HOSTS.map((host) => ({
                                value: host,
                                label: (
                                    <>
                                        <GitHostIcon host={host} className="size-3.5" /> {getHostLabel(host)}
                                    </>
                                ),
                            }))}
                        />
                    </div>
                    <HostAuthForm host={activeHost} mode="onboarding" />
                </section>
            </div>
        </main>
    );
}
