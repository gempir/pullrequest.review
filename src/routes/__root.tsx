/// <reference types="vite/client" />

import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Link, Outlet, Scripts, useHydrated, useRouterState } from "@tanstack/react-router";
import { GitPullRequest } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { HostAuthForm } from "@/components/auth/host-auth-form";
import { GitHostIcon } from "@/components/git-host-icon";
import { AppPullRequestOmnibar } from "@/components/omnibar/app-pull-request-omnibar";
import { AppearanceProvider } from "@/lib/appearance-context";
import { ensureDataCollectionsReady } from "@/lib/data/query-collections";
import { DiffOptionsProvider } from "@/lib/diff-options-context";
import { FileTreeProvider } from "@/lib/file-tree-context";
import { getHostLabel } from "@/lib/git-host/service";
import type { GitHost } from "@/lib/git-host/types";
import { PrProvider, usePrContext } from "@/lib/pr-context";
import { appQueryClient } from "@/lib/query-client";
import { ensureLongTaskObserver } from "@/lib/review-performance/metrics";
import { ShikiAppThemeSync } from "@/lib/shiki-app-theme-sync";
import { ShortcutsProvider } from "@/lib/shortcuts-context";
import { cn } from "@/lib/utils";

const ONBOARDING_HOSTS: GitHost[] = ["bitbucket", "github"];

import "../../styles.css";

export const Route = createRootRoute({
    head: () => ({
        meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { title: "pullrequest.review" }],
    }),
    shellComponent: RootDocument,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
    return (
        <div className="h-full overflow-auto bg-background">
            <div className="min-h-full flex items-center justify-center p-4">
                <div className="bg-card p-6 max-w-md">
                    <div className="pb-3 mb-4">
                        <h1 className="text-lg font-semibold">[ERROR] 404</h1>
                    </div>
                    <p className="text-muted-foreground mb-4">Page not found.</p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 h-8 px-4 bg-accent-solid text-accent-foreground hover:bg-accent-solid-hover transition-colors text-[13px]"
                    >
                        cd ~
                    </Link>
                </div>
            </div>
        </div>
    );
}

function RootComponent() {
    useEffect(() => {
        void ensureDataCollectionsReady();
        ensureLongTaskObserver();
    }, []);

    return (
        <QueryClientProvider client={appQueryClient}>
            <AppearanceProvider>
                <PrProvider>
                    <DiffOptionsProvider>
                        <ShikiAppThemeSync />
                        <FileTreeProvider>
                            <ShortcutsProvider>
                                <AppLayout />
                            </ShortcutsProvider>
                        </FileTreeProvider>
                    </DiffOptionsProvider>
                </PrProvider>
            </AppearanceProvider>
        </QueryClientProvider>
    );
}

function OnboardingScreen() {
    const { setActiveHost, activeHost } = usePrContext();

    return (
        <div className="h-full min-h-0 flex flex-col bg-background">
            <header data-component="navbar" className="h-11 shrink-0 bg-chrome border-b border-border-muted px-3 flex items-center gap-2 text-[12px]">
                <GitPullRequest className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Connect Git Host</span>
            </header>

            <main data-component="diff-view" className="flex-1 min-h-0 overflow-y-auto p-4">
                <div className="mx-auto w-full max-w-2xl space-y-4">
                    <div role="tablist" aria-label="Git host" className="flex border-b border-border-muted">
                        {ONBOARDING_HOSTS.map((host) => {
                            const isActive = activeHost === host;
                            return (
                                <button
                                    key={host}
                                    type="button"
                                    role="tab"
                                    id={`onboarding-host-tab-${host}`}
                                    aria-selected={isActive}
                                    aria-controls={`onboarding-host-panel-${host}`}
                                    tabIndex={isActive ? 0 : -1}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] transition-colors",
                                        isActive
                                            ? "-mb-px border-foreground text-foreground"
                                            : "border-transparent text-muted-foreground hover:text-foreground",
                                    )}
                                    onClick={() => {
                                        setActiveHost(host);
                                    }}
                                >
                                    <GitHostIcon host={host} className="size-3.5" />
                                    <span>{getHostLabel(host)}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div role="tabpanel" id={`onboarding-host-panel-${activeHost}`} aria-labelledby={`onboarding-host-tab-${activeHost}`}>
                        <HostAuthForm host={activeHost} mode="onboarding" />
                    </div>
                </div>
            </main>
        </div>
    );
}

function AppLayout() {
    const { authHydrated, isAuthenticated } = usePrContext();
    const hydrated = useHydrated();
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });
    const isGithubPullPath = /^\/[^/]+\/[^/]+\/pull\/[^/]+/.test(pathname);
    const isSettingsPath = pathname === "/settings" || pathname === "/settings/";

    if (!hydrated) {
        return null;
    }

    if (pathname.startsWith("/oauth/callback")) {
        return <Outlet />;
    }

    if (!authHydrated) {
        return null;
    }

    if (!isAuthenticated && !isGithubPullPath && !isSettingsPath) {
        return <OnboardingScreen />;
    }

    return (
        <div className="h-dvh overflow-hidden bg-background">
            <div className="h-full min-h-0 overflow-hidden bg-background">
                <Outlet />
            </div>
            <AppPullRequestOmnibar />
        </div>
    );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <html lang="en">
            <head>
                <HeadContent />
                <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link rel="shortcut icon" href="/favicon.ico" />
                <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
                <meta name="apple-mobile-web-app-title" content="pullrequest.review" />
                <link rel="manifest" href="/site.webmanifest" />
            </head>
            <body>
                {children}
                <Scripts />
            </body>
        </html>
    );
}
