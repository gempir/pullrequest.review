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
import { PrProvider, usePrContext } from "@/lib/pr-context";
import type { BitbucketRepo } from "@/lib/bitbucket-api";
import { DiffOptionsProvider } from "@/lib/diff-options-context";
import { FileTreeProvider, useFileTree } from "@/lib/file-tree-context";
import { ShortcutsProvider, useKeyboardNavigation } from "@/lib/shortcuts-context";
import { SettingsMenu } from "@/components/settings-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
import { buildAuthorizeUrl } from "@/lib/bitbucket-oauth";
import { GitPullRequest, LogOut, Search, FolderGit } from "lucide-react";

import "../../styles.css";

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
        <div className="w-full max-w-2xl border border-border bg-card">
          {/* Header */}
          <div className="border-b border-border px-4 py-3 flex items-center gap-3 bg-secondary">
            <FolderGit className="size-4 text-muted-foreground" />
            <span className="text-[13px] font-medium">Select Repositories</span>
          </div>
          
          <div className="p-4 space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Choose one or more repositories to load pull requests from.
            </p>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Filter repositories..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
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
              <div className="border border-border bg-background p-8 text-center text-muted-foreground text-[13px]">
                <div className="flex items-center justify-center gap-2">
                  <span className="animate-pulse">Loading repositories...</span>
                </div>
              </div>
            ) : reposQuery.error ? (
              <div className="border border-destructive bg-destructive/10 p-4 text-destructive text-[13px]">
                [ERROR] {reposQuery.error instanceof Error
                  ? reposQuery.error.message
                  : "Failed to load repositories"}
              </div>
            ) : (
              <div className="border border-border bg-background max-h-80 overflow-auto">
                <div className="divide-y divide-border">
                  {filtered.map((repo) => {
                    const fallbackName = `${repo.workspace?.slug ?? "unknown"}/${repo.slug}`;
                    const fullName = repo.full_name ?? fallbackName;
                    const checked = selected.has(fullName);
                    return (
                      <label
                        key={fullName}
                        className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-accent cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="size-4 border border-input bg-background checked:bg-foreground checked:border-foreground"
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
                        <span className="flex-1 truncate font-mono text-xs">{fullName}</span>
                      </label>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="px-4 py-8 text-center text-muted-foreground text-[13px]">
                      No repositories match your filter.
                    </div>
                  )}
                </div>
              </div>
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
              className="w-full"
              disabled={selected.size === 0}
            >
              Add Selected Repositories ({selected.size})
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const clientId = import.meta.env.VITE_BITBUCKET_CLIENT_ID as string | undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg border border-border bg-card">
        {/* Header */}
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
  const { auth, clearAuth, clearRepos, repos, prUrl, setPrUrl } = usePrContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const fileTree = useFileTree();

  const handleNextFile = useCallback(() => {
    const nextPath = fileTree.navigateToNextFile();
    if (nextPath) {
      const anchor = document.getElementById(fileAnchorId(nextPath));
      anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [fileTree]);

  const handlePreviousFile = useCallback(() => {
    const prevPath = fileTree.navigateToPreviousFile();
    if (prevPath) {
      const anchor = document.getElementById(fileAnchorId(prevPath));
      anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [fileTree]);

  // Register keyboard navigation
  useKeyboardNavigation({
    onNextFile: handleNextFile,
    onPreviousFile: handlePreviousFile,
  });

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
    <div className="flex flex-col h-screen bg-background">
      {/* Terminal-style header */}
      <header className="flex items-center border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 px-4 h-10 border-r border-border">
          <GitPullRequest className="size-4 text-muted-foreground" />
          <span className="text-[13px] font-medium">PR Review</span>
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-4 px-4 h-10 border-l border-border">
          {prUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPrUrl("")}
              className="h-7 text-xs"
            >
              Close PR
            </Button>
          )}
          <SettingsMenu />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearRepos();
              clearAuth();
            }}
            className="h-7 text-xs gap-1.5"
          >
            <LogOut className="size-3.5" />
            <span>Disconnect</span>
          </Button>
        </div>
      </header>
      
      <main className="flex-1 min-h-0 overflow-auto bg-background">
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
