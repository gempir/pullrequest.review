/// <reference types="vite/client" />
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrProvider, usePrContext } from "@/lib/pr-context";
import { DiffOptionsProvider } from "@/lib/diff-options-context";
import { FileTreeProvider } from "@/lib/file-tree-context";
import { ShortcutsProvider } from "@/lib/shortcuts-context";
import { AppearanceProvider } from "@/lib/appearance-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginWithApiCredentials } from "@/lib/bitbucket-oauth";
import { ExternalLink, GitPullRequest } from "lucide-react";

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
  const { setAuthenticated } = usePrContext();
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [copiedScopes, setCopiedScopes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requiredScopes = [
    "read:repository:bitbucket",
    "read:user:bitbucket",
    "read:pullrequest:bitbucket",
    "write:pullrequest:bitbucket",
  ];
  const requiredScopesText = requiredScopes.join(", ");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 flex items-center gap-3 bg-secondary">
          <GitPullRequest className="size-4 text-muted-foreground" />
          <span className="text-[14px] font-medium">Connect Bitbucket</span>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-[14px] text-muted-foreground">
            Use your Bitbucket email and API token to continue.
          </p>

          <div className="border border-border bg-background p-3 text-[13px] space-y-2">
            <div className="text-muted-foreground">Required scopes</div>
            <div className="leading-relaxed break-words">
              {requiredScopesText}
            </div>
            <div className="border border-yellow-500/50 bg-yellow-500/15 text-yellow-300 px-2 py-1.5 text-[12px]">
              Hint: You can paste these into "Search by scope name".
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                void navigator.clipboard.writeText(requiredScopesText);
                setCopiedScopes(true);
                window.setTimeout(() => {
                  setCopiedScopes(false);
                }, 1200);
              }}
            >
              {copiedScopes ? "Copied" : "Copy scopes"}
            </Button>
          </div>

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

          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              setIsSubmitting(true);
              setError(null);
              loginWithApiCredentials({ email, apiToken })
                .then(() => {
                  setAuthenticated(true);
                })
                .catch((err) => {
                  const msg =
                    err instanceof Error
                      ? err.message
                      : "Failed to authenticate";
                  setError(msg);
                })
                .finally(() => setIsSubmitting(false));
            }}
          >
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
            <Button
              type="submit"
              className="w-full text-[14px] h-10"
              disabled={isSubmitting || !email.trim() || !apiToken.trim()}
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
      </div>
    </div>
  );
}

function AppLayout() {
  const { authHydrated, isAuthenticated } = usePrContext();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname.startsWith("/oauth/callback")) {
    return <Outlet />;
  }

  if (!authHydrated) {
    return null;
  }

  if (!isAuthenticated) {
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
