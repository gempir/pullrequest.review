/// <reference types="vite/client" />

import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, HeadContent, Link, Outlet, Scripts, useHydrated, useRouterState } from "@tanstack/react-router";
import { domMax, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { AppPullRequestOmnibar } from "@/components/omnibar/app-pull-request-omnibar";
import { WelcomeScreen } from "@/features/landing/components/welcome-screen";
import { AppearanceProvider } from "@/lib/appearance-context";
import { DiffOptionsProvider } from "@/lib/diff-options-context";
import { FileTreeProvider } from "@/lib/file-tree-context";
import { PrProvider, usePrContext } from "@/lib/pr-context";
import { appQueryClient } from "@/lib/query-client";
import { ShikiAppThemeSync } from "@/lib/shiki-app-theme-sync";
import { ShortcutsProvider } from "@/lib/shortcuts-context";

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
        <div className="flex h-full items-center justify-center overflow-auto p-4">
            <div className="glass max-w-md rounded-2xl p-6 text-center">
                <h1 className="display-title text-[26px]">Page not found</h1>
                <p className="mb-5 mt-2 text-muted-foreground">There is nothing at this address.</p>
                <Link
                    to="/"
                    className="pressable inline-flex h-9 items-center rounded-full bg-accent-solid px-5 text-[13px] font-medium text-accent-foreground hover:bg-accent-solid-hover"
                >
                    Back to inbox
                </Link>
            </div>
        </div>
    );
}

function RootComponent() {
    return (
        <QueryClientProvider client={appQueryClient}>
            <LazyMotion features={domMax}>
                <MotionConfig reducedMotion="user">
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
                </MotionConfig>
            </LazyMotion>
        </QueryClientProvider>
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
        return <WelcomeScreen />;
    }

    return (
        <div className="h-dvh overflow-hidden">
            <main className="h-full min-h-0 overflow-hidden">
                <Outlet />
            </main>
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
