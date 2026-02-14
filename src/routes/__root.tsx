/// <reference types="vite/client" />

import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { ExternalLink, GitPullRequest } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { GitHostIcon } from "@/components/git-host-icon";
import { SidebarTopControls } from "@/components/sidebar-top-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppearanceProvider } from "@/lib/appearance-context";
import { DiffOptionsProvider } from "@/lib/diff-options-context";
import { FileTreeProvider } from "@/lib/file-tree-context";
import { ensureGitHostDataReady } from "@/lib/git-host/query-collections";
import { getHostLabel } from "@/lib/git-host/service";
import type { GitHost } from "@/lib/git-host/types";
import { PrProvider, usePrContext } from "@/lib/pr-context";
import { appQueryClient } from "@/lib/query-client";
import { ShikiAppThemeSync } from "@/lib/shiki-app-theme-sync";
import { ShortcutsProvider } from "@/lib/shortcuts-context";
import { ensureStorageReady } from "@/lib/storage/versioned-local-storage";

import "../../styles.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "pullrequest.review" },
    ],
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
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([ensureStorageReady(), ensureGitHostDataReady()]).finally(
      () => {
        if (cancelled) return;
        setStorageReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RootDocument>
      <QueryClientProvider client={appQueryClient}>
        {storageReady ? (
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
        ) : (
          <div className="h-full bg-background" />
        )}
      </QueryClientProvider>
    </RootDocument>
  );
}

function OnboardingScreen() {
  const { login, setActiveHost, activeHost } = usePrContext();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [copiedScopes, setCopiedScopes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bitbucketScopes = [
    "read:repository:bitbucket",
    "read:user:bitbucket",
    "read:pullrequest:bitbucket",
    "write:pullrequest:bitbucket",
  ];

  const scopeText = bitbucketScopes.join(", ");

  return (
    <div className="h-full min-h-0 flex bg-background">
      <aside
        data-component="sidebar"
        className="w-[300px] shrink-0 border-r border-border bg-sidebar flex flex-col"
      >
        <SidebarTopControls
          onHome={() => {
            navigate({ to: "/" });
          }}
          onSettings={() => {
            navigate({ to: "/settings" });
          }}
        />
        <div
          data-component="search-sidebar"
          className="h-10 pl-2 pr-2 border-b border-border flex items-center"
        >
          <span className="text-[11px] text-muted-foreground px-1">
            Select host
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto" data-component="tree">
          {(["bitbucket", "github"] as GitHost[]).map((host) => (
            <button
              key={host}
              type="button"
              className={`w-full flex items-center gap-2 px-2 py-1 text-left text-[12px] hover:bg-accent ${
                activeHost === host
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => {
                setActiveHost(host);
                setError(null);
              }}
            >
              <GitHostIcon host={host} className="size-3.5" />
              <span className="truncate">{getHostLabel(host)}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex-1 min-w-0 min-h-0 flex flex-col">
        <header
          data-component="navbar"
          className="h-11 border-b border-border bg-card px-3 flex items-center gap-2 text-[12px]"
        >
          <GitPullRequest className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Connect Git Host</span>
          <span className="ml-auto text-muted-foreground">
            {getHostLabel(activeHost)}
          </span>
        </header>

        <main
          data-component="diff-view"
          className="flex-1 min-h-0 overflow-y-auto p-4"
        >
          <div className="max-w-2xl space-y-4">
            <p className="text-[13px] text-muted-foreground">
              {activeHost === "bitbucket"
                ? "Use your Bitbucket email and API token to continue."
                : "Use a GitHub fine-grained personal access token to continue."}
            </p>

            {activeHost === "bitbucket" ? (
              <div className="border border-border bg-card p-3 text-[13px] space-y-2">
                <div className="text-muted-foreground">Required scopes</div>
                <div className="leading-relaxed break-words">{scopeText}</div>
                <div className="border border-yellow-500/50 bg-yellow-500/15 text-yellow-300 px-2 py-1.5 text-[12px]">
                  Hint: Paste these scopes into "Search by scope name" while
                  creating the token
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => {
                    void navigator.clipboard.writeText(scopeText);
                    setCopiedScopes(true);
                    window.setTimeout(() => setCopiedScopes(false), 1200);
                  }}
                >
                  {copiedScopes ? "Copied" : "Copy scopes"}
                </Button>
              </div>
            ) : null}

            {activeHost === "bitbucket" ? (
              <Button
                className="w-full text-white bg-[#0146b3] border-[#0146b3] hover:bg-[#0052cc] hover:border-[#0052cc] cursor-pointer"
                onClick={() =>
                  window.open(
                    "https://id.atlassian.com/manage-profile/security/api-tokens",
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                <ExternalLink className="size-3.5" />
                Create Atlassian Bitbucket Scoped API Token
              </Button>
            ) : (
              <Button
                className="w-full"
                variant="outline"
                onClick={() =>
                  window.open(
                    "https://github.com/settings/personal-access-tokens/new",
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                <ExternalLink className="size-3.5" />
                Create GitHub Fine-Grained Token
              </Button>
            )}

            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                setIsSubmitting(true);
                setError(null);

                const authPromise =
                  activeHost === "bitbucket"
                    ? login({ host: "bitbucket", email, apiToken })
                    : login({ host: "github", token: githubToken });

                authPromise
                  .catch((err) => {
                    const msg =
                      err instanceof Error
                        ? err.message
                        : "Failed to authenticate";
                    setError(msg);
                  })
                  .finally(() => {
                    setIsSubmitting(false);
                  });
              }}
            >
              {activeHost === "bitbucket" ? (
                <>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Bitbucket account email"
                    autoComplete="email"
                    className="text-[14px] h-10"
                  />
                  <Input
                    type="password"
                    value={apiToken}
                    onChange={(event) => setApiToken(event.target.value)}
                    placeholder="Bitbucket API token"
                    autoComplete="current-password"
                    className="text-[14px] h-10"
                  />
                </>
              ) : (
                <Input
                  type="password"
                  value={githubToken}
                  onChange={(event) => setGithubToken(event.target.value)}
                  placeholder="GitHub fine-grained personal access token"
                  autoComplete="current-password"
                  className="text-[14px] h-10"
                />
              )}

              <Button
                type="submit"
                className="w-full text-[14px] h-10"
                disabled={
                  isSubmitting ||
                  (activeHost === "bitbucket"
                    ? !email.trim() || !apiToken.trim()
                    : !githubToken.trim())
                }
              >
                Authenticate
              </Button>
            </form>

            {error && (
              <div className="border border-destructive bg-destructive/10 p-3 text-destructive text-[13px]">
                [AUTH ERROR] {error}
              </div>
            )}

            <p className="text-[12px] text-muted-foreground">
              Credentials are stored in browser local storage.
            </p>
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
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
