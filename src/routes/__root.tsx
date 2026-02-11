/// <reference types="vite/client" />
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrProvider, usePrContext } from "@/lib/pr-context";
import { DiffOptionsProvider } from "@/lib/diff-options-context";
import { FileTreeProvider } from "@/lib/file-tree-context";
import { ShortcutsProvider } from "@/lib/shortcuts-context";
import { Button } from "@/components/ui/button";
import { buildAuthorizeUrl } from "@/lib/bitbucket-oauth";
import { GitPullRequest } from "lucide-react";

import "../../styles.css";

const queryClient = new QueryClient();

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PR Review" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
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
  );
}

function RootComponent() {
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <PrProvider>
          <DiffOptionsProvider>
            <FileTreeProvider>
              <ShortcutsProvider>
                <AppLayout />
              </ShortcutsProvider>
            </FileTreeProvider>
          </DiffOptionsProvider>
        </PrProvider>
      </QueryClientProvider>
    </RootDocument>
  );
}

function OnboardingScreen() {
  const clientId = import.meta.env.VITE_BITBUCKET_CLIENT_ID as string | undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 flex items-center gap-3 bg-secondary">
          <GitPullRequest className="size-4 text-muted-foreground" />
          <span className="text-[13px] font-medium">Connect Bitbucket</span>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-[13px] text-muted-foreground">
            Connect your Bitbucket Cloud account to continue.
          </p>

          <Button
            onClick={() => {
              if (!clientId) return;
              const state = crypto.getRandomValues(new Uint32Array(4)).join("-");
              const redirectUri = `${window.location.origin}/oauth/callback`;
              window.localStorage.setItem("bitbucket_oauth_state", state);
              const url = buildAuthorizeUrl({
                clientId,
                redirectUri,
                state,
                scope: "repository pullrequest",
              });
              window.location.assign(url);
            }}
            className="w-full"
            disabled={!clientId}
          >
            Connect with Bitbucket
          </Button>

          {!clientId && (
            <div className="border border-destructive bg-destructive/10 p-3 text-destructive text-[12px]">
              [CONFIG ERROR] Missing VITE_BITBUCKET_CLIENT_ID in environment
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppLayout() {
  const { auth } = usePrContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname.startsWith("/oauth/callback")) {
    return <Outlet />;
  }

  if (!auth?.accessToken) {
    return <OnboardingScreen />;
  }

  return (
    <div className="h-screen bg-background">
      <main className="h-full min-h-0 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
