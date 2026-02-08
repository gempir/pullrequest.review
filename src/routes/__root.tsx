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
import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrProvider, usePrContext, type BitbucketRepo } from "@/lib/pr-context";
import { DiffOptionsProvider } from "@/lib/diff-options-context";
import { FileTreeProvider } from "@/lib/file-tree-context";
import { DiffToolbar } from "@/components/diff-toolbar";
import { FileTree } from "@/components/file-tree";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { fileAnchorId } from "@/lib/file-anchors";
import { buildAuthorizeUrl } from "@/lib/bitbucket-oauth";

import appCss from "../../styles.css?url";

const queryClient = new QueryClient();

interface BitbucketRepoEntry {
  name: string;
  full_name: string;
  slug: string;
  workspace?: { slug?: string };
}

interface BitbucketRepoPage {
  values: BitbucketRepoEntry[];
  next?: string;
}

const fetchBitbucketRepos = createServerFn({
  method: "GET",
}).handler(async ({ data }: { data: { accessToken: string } }) => {
  const token = data.accessToken.trim();
  if (!token) {
    throw new Error("Access token is required");
  }

  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const values: BitbucketRepoEntry[] = [];
  let nextUrl: string | undefined =
    "https://api.bitbucket.org/2.0/repositories?role=member&pagelen=100";

  while (nextUrl) {
    const res = await fetch(nextUrl, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch repositories: ${res.status} ${res.statusText}`);
    }
    const page = (await res.json()) as BitbucketRepoPage;
    values.push(...(page.values ?? []));
    nextUrl = page.next;
  }

  return values;
});

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PR Review" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 antialiased">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">404</h1>
        <p className="text-muted-foreground">Page not found.</p>
        <Link
          to="/"
          className="inline-block px-4 py-2 bg-foreground text-background rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
        >
          Back to Home
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
              <AppLayout />
            </FileTreeProvider>
          </DiffOptionsProvider>
        </PrProvider>
      </QueryClientProvider>
    </RootDocument>
  );
}

function OnboardingScreen() {
  const { auth, setRepos, clearAuth, clearRepos } = usePrContext();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reposQuery = useQuery({
    queryKey: ["bitbucket-repos", auth?.accessToken],
    queryFn: () =>
      fetchBitbucketRepos({ data: { accessToken: auth?.accessToken ?? "" } }),
    enabled: Boolean(auth?.accessToken),
  });

  if (auth?.accessToken) {
    const entries = reposQuery.data ?? [];
    const filtered = entries.filter((repo) => {
      const term = query.trim().toLowerCase();
      if (!term) return true;
      const fullName = repo.full_name?.toLowerCase() ?? "";
      const name = repo.name?.toLowerCase() ?? "";
      return fullName.includes(term) || name.includes(term);
    });

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-2xl space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">Select Repositories</h1>
            <p className="text-sm text-muted-foreground">
              Choose one or more repositories to load pull requests from.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Filter repositories..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 text-sm"
            />
            <Button
              variant="outline"
              className="h-9 text-sm"
              onClick={() => {
                setSelected(new Set());
                clearRepos();
                clearAuth();
              }}
            >
              Change Token
            </Button>
          </div>

          {reposQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading repositories...</p>
          ) : reposQuery.error ? (
            <p className="text-sm text-destructive">
              {reposQuery.error instanceof Error
                ? reposQuery.error.message
                : "Failed to load repositories"}
            </p>
          ) : (
            <ScrollArea className="h-80 rounded-md border">
              <div className="p-3 space-y-2">
                {filtered.map((repo) => {
                  const fallbackName = `${repo.workspace?.slug ?? "unknown"}/${repo.slug}`;
                  const fullName = repo.full_name ?? fallbackName;
                  const checked = selected.has(fullName);
                  return (
                    <label
                      key={fullName}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={checked}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(fullName);
                            else next.delete(fullName);
                            return next;
                          });
                        }}
                      />
                      <span className="flex-1 truncate">{fullName}</span>
                    </label>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No repositories match your filter.
                  </p>
                )}
              </div>
            </ScrollArea>
          )}

          <Button
            onClick={() => {
              const selectedRepos: BitbucketRepo[] = entries
                .map((repo) => {
                  const fallbackName = `${repo.workspace?.slug ?? "unknown"}/${repo.slug}`;
                  const fullName = repo.full_name ?? fallbackName;
                  return {
                    entry: repo,
                    fullName,
                  };
                })
                .filter(({ fullName }) => selected.has(fullName))
                .map(({ entry, fullName }) => ({
                  name: entry.name,
                  fullName,
                  slug: entry.slug,
                  workspace: entry.workspace?.slug ?? fullName.split("/")[0],
                }))
                .filter((repo) => repo.workspace && repo.slug);
              if (selectedRepos.length > 0) {
                setRepos(selectedRepos);
              }
            }}
            className="h-9 text-sm w-full"
            disabled={selected.size === 0}
          >
            Add Selected Repositories
          </Button>
        </div>
      </div>
    );
  }

  const clientId = import.meta.env.VITE_BITBUCKET_CLIENT_ID as string | undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Connect Bitbucket</h1>
          <p className="text-sm text-muted-foreground">
            Connect your Bitbucket Cloud account to continue.
          </p>
        </div>
        <div className="space-y-3">
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
            className="h-9 text-sm w-full"
            disabled={!clientId}
          >
            Connect with Bitbucket
          </Button>
          {!clientId && (
            <p className="text-xs text-destructive">
              Missing `VITE_BITBUCKET_CLIENT_ID` in your environment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AppLayout() {
  const { auth, clearAuth, clearRepos, repos } = usePrContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname.startsWith("/oauth/callback")) {
    return <Outlet />;
  }

  if (!auth?.accessToken) {
    return <OnboardingScreen />;
  }
  if (repos.length === 0) {
    return <OnboardingScreen />;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-4 border-b px-4 py-2 shrink-0">
        <h1 className="text-sm font-semibold tracking-tight whitespace-nowrap">PR Review</h1>
        <DiffToolbar />
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              clearRepos();
              clearAuth();
            }}
          >
            Remove Token
          </Button>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <aside className="w-64 shrink-0 border-r">
          <ScrollArea className="h-full">
            <div className="p-2">
              <FileTree
                path=""
                onFileClick={(node) => {
                  const anchor = document.getElementById(fileAnchorId(node.path));
                  anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            </div>
          </ScrollArea>
        </aside>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
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
