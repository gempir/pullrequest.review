/// <reference types="vite/client" />

import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Link, Outlet, Scripts, useNavigate, useRouterState } from "@tanstack/react-router";
import { GitPullRequest } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { HostAuthForm } from "@/components/auth/host-auth-form";
import { GitHostIcon } from "@/components/git-host-icon";
import { SidebarTopControls } from "@/components/sidebar-top-controls";
import { AppearanceProvider } from "@/lib/appearance-context";
import { ensureDataCollectionsReady } from "@/lib/data/query-collections";
import { DiffOptionsProvider } from "@/lib/diff-options-context";
import { FileTreeProvider } from "@/lib/file-tree-context";
import { getHostLabel } from "@/lib/git-host/service";
import type { GitHost } from "@/lib/git-host/types";
import { PrProvider, usePrContext } from "@/lib/pr-context";
import { appQueryClient } from "@/lib/query-client";
import { ensureLongTaskObserver } from "@/lib/review-performance/metrics";
import { ShortcutsProvider } from "@/lib/shortcuts-context";

import "../../styles.css";

export const Route = createRootRoute({
    head: () => ({
        meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { title: "pullrequest.review" }],
    }),
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
    return (
        <div className="h-full overflow-auto bg-background">
            <div className="min-h-full flex items-center justify-center p-4">
                <div className="border border-border bg-card p-6 max-w-md">
                    <div className="border-b border-border pb-3 mb-4">
                        <h1 className="text-lg font-semibold">[ERROR] 404</h1>
                    </div>
                    <p className="text-muted-foreground mb-4">Page not found.</p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 h-8 px-4 bg-foreground text-background border border-foreground hover:bg-background hover:text-foreground transition-colors text-[13px]"
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
        <RootDocument>
            <QueryClientProvider client={appQueryClient}>
                <AppearanceProvider>
                    <PrProvider>
                        <DiffOptionsProvider>
                            <FileTreeProvider>
                                <ShortcutsProvider>
                                    <AppLayout />
                                </ShortcutsProvider>
                            </FileTreeProvider>
                        </DiffOptionsProvider>
                    </PrProvider>
                </AppearanceProvider>
            </QueryClientProvider>
        </RootDocument>
    );
}

function OnboardingScreen() {
    const { setActiveHost, activeHost, refreshAuth } = usePrContext();
    const navigate = useNavigate();

    return (
        <div className="h-full min-h-0 flex bg-background">
            <aside data-component="sidebar" className="w-[300px] shrink-0 border-r border-border bg-background flex flex-col">
                <SidebarTopControls
                    onHome={() => {
                        navigate({ to: "/" });
                    }}
                    onRefresh={() => refreshAuth()}
                    onSettings={() => {
                        navigate({ to: "/settings" });
                    }}
                />
                <div data-component="search-sidebar" className="h-10 pl-2 pr-2 border-b border-border bg-chrome flex items-center">
                    <span className="text-[11px] text-muted-foreground px-1">Select host</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto" data-component="tree">
                    {(["bitbucket", "github"] as GitHost[]).map((host) => (
                        <button
                            key={host}
                            type="button"
                            className={`w-full flex items-center gap-2 px-2 py-1 text-left text-[12px] hover:bg-accent ${
                                activeHost === host ? "bg-accent text-foreground" : "text-muted-foreground"
                            }`}
                            onClick={() => {
                                setActiveHost(host);
                            }}
                        >
                            <GitHostIcon host={host} className="size-3.5" />
                            <span className="truncate">{getHostLabel(host)}</span>
                        </button>
                    ))}
                </div>
            </aside>

            <section className="flex-1 min-w-0 min-h-0 flex flex-col">
                <header data-component="navbar" className="h-11 border-b border-border bg-chrome px-3 flex items-center gap-2 text-[12px]">
                    <GitPullRequest className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Connect Git Host</span>
                    <span className="ml-auto text-muted-foreground">{getHostLabel(activeHost)}</span>
                </header>

                <main data-component="diff-view" className="flex-1 min-h-0 overflow-y-auto p-4">
                    <div className="max-w-2xl space-y-4">
                        <HostAuthForm host={activeHost} mode="onboarding" />
                    </div>
                </main>
            </section>
        </div>
    );
}

function AppLayout() {
    const { authHydrated, isAuthenticated } = usePrContext();
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });
    const isGithubPullPath = /^\/[^/]+\/[^/]+\/pull\/[^/]+/.test(pathname);
    const isSettingsPath = pathname === "/settings" || pathname === "/settings/";

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
            <main className="h-full min-h-0 overflow-hidden bg-background">
                <Outlet />
            </main>
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
