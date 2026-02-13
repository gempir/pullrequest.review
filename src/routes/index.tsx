import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ExternalLink,
  FolderGit,
  GitPullRequest,
  Loader2,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FileTree } from "@/components/file-tree";
import { RepositorySelector } from "@/components/repository-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type FileNode, useFileTree } from "@/lib/file-tree-context";
import {
  fetchRepoPullRequestsByHost,
  getHostLabel,
} from "@/lib/git-host/service";
import type {
  GitHost,
  PullRequestSummary,
  RepoRef,
} from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";
import { cn } from "@/lib/utils";

const HOSTS: GitHost[] = ["bitbucket", "github"];

type LandingMode = "pull-requests" | "repositories" | "hosts";
type LandingSearch = { mode?: LandingMode };
type PullRequestTreeMeta = {
  host: GitHost;
  workspace: string;
  repo: string;
  pullRequestId: string;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): LandingSearch => ({
    mode:
      search.mode === "pull-requests" ||
      search.mode === "repositories" ||
      search.mode === "hosts"
        ? search.mode
        : undefined,
  }),
  component: LandingPage,
});

function HostTree({
  activeHost,
  onSelect,
}: {
  activeHost: GitHost;
  onSelect: (host: GitHost) => void;
}) {
  return (
    <div className="flex flex-col py-1" data-component="tree">
      {HOSTS.map((host) => (
        <button
          key={host}
          type="button"
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1 text-left text-[12px] hover:bg-accent",
            activeHost === host
              ? "bg-accent text-foreground"
              : "text-muted-foreground",
          )}
          onClick={() => onSelect(host)}
        >
          <FolderGit className="size-3.5" />
          <span className="truncate">{getHostLabel(host)}</span>
        </button>
      ))}
    </div>
  );
}

function HostAuthPanel({ host }: { host: GitHost }) {
  const { authByHost, login, logout } = usePrContext();
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticated = authByHost[host];

  if (authenticated) {
    return (
      <div className="space-y-3">
        <div className="text-[13px] text-muted-foreground">
          {getHostLabel(host)} is connected.
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void logout(host);
          }}
        >
          Disconnect {getHostLabel(host)}
        </Button>
      </div>
    );
  }

  const bitbucketScopeText = [
    "read:repository:bitbucket",
    "read:user:bitbucket",
    "read:pullrequest:bitbucket",
    "write:pullrequest:bitbucket",
  ].join(", ");

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        const promise =
          host === "bitbucket"
            ? login({ host: "bitbucket", email, apiToken })
            : login({ host: "github", token: githubToken });

        promise
          .catch((err) => {
            setError(
              err instanceof Error ? err.message : "Failed to authenticate",
            );
          })
          .finally(() => {
            setIsSubmitting(false);
          });
      }}
    >
      {host === "bitbucket" ? (
        <div className="border border-border bg-card p-3 text-[12px] space-y-2">
          <div className="text-muted-foreground">Required scopes</div>
          <div className="break-words">{bitbucketScopeText}</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              void navigator.clipboard.writeText(bitbucketScopeText);
            }}
          >
            Copy scopes
          </Button>
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() =>
          window.open(
            host === "bitbucket"
              ? "https://id.atlassian.com/manage-profile/security/api-tokens"
              : "https://github.com/settings/personal-access-tokens/new",
            "_blank",
            "noopener,noreferrer",
          )
        }
      >
        <ExternalLink className="size-3.5" />
        {host === "bitbucket"
          ? "Create Atlassian Bitbucket Scoped API Token"
          : "Create GitHub Fine-Grained Token"}
      </Button>

      {host === "bitbucket" ? (
        <>
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Bitbucket email"
          />
          <Input
            type="password"
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            placeholder="Bitbucket API token"
          />
        </>
      ) : (
        <Input
          type="password"
          value={githubToken}
          onChange={(event) => setGithubToken(event.target.value)}
          placeholder="GitHub fine-grained PAT"
        />
      )}

      <Button
        type="submit"
        disabled={
          isSubmitting ||
          (host === "bitbucket"
            ? !email.trim() || !apiToken.trim()
            : !githubToken.trim())
        }
      >
        Connect {getHostLabel(host)}
      </Button>

      {error && (
        <div className="border border-destructive bg-destructive/10 p-3 text-destructive text-[13px]">
          {error}
        </div>
      )}
    </form>
  );
}

function buildPullRequestTree(
  reposByHost: Record<GitHost, RepoRef[]>,
  pullRequestsByRepo: Map<string, PullRequestSummary[]>,
  query: string,
) {
  const term = query.trim().toLowerCase();
  const pullRequestMeta = new Map<string, PullRequestTreeMeta>();
  const root: FileNode[] = [];

  for (const host of HOSTS) {
    const hostNode: FileNode = {
      name: getHostLabel(host),
      path: `host:${host}`,
      type: "directory",
      children: [],
    };

    for (const repo of reposByHost[host]) {
      const key = `${host}:${repo.fullName}`;
      const prs = pullRequestsByRepo.get(key) ?? [];
      const repoMatches =
        !term ||
        repo.fullName.toLowerCase().includes(term) ||
        repo.displayName.toLowerCase().includes(term);
      const filteredPrs = repoMatches
        ? prs
        : prs.filter((pr) => {
            const author = pr.author?.display_name ?? "";
            return (
              pr.title.toLowerCase().includes(term) ||
              String(pr.id).includes(term) ||
              author.toLowerCase().includes(term)
            );
          });

      if (!repoMatches && filteredPrs.length === 0) continue;

      const repoPath = `repo:${host}:${repo.workspace}:${repo.repo}`;
      const repoNode: FileNode = {
        name: repo.fullName,
        path: repoPath,
        type: "directory",
        children: filteredPrs.map((pr) => {
          const path = `pr:${host}:${repo.workspace}:${repo.repo}:${pr.id}`;
          pullRequestMeta.set(path, {
            host: repo.host,
            workspace: repo.workspace,
            repo: repo.repo,
            pullRequestId: String(pr.id),
          });
          return {
            name: `#${pr.id} ${pr.title}`,
            path,
            type: "file",
          };
        }),
      };

      hostNode.children?.push(repoNode);
    }

    if (hostNode.children && hostNode.children.length > 0) {
      root.push(hostNode);
    }
  }

  return { root, pullRequestMeta };
}

function LandingPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tree = useFileTree();
  const {
    authByHost,
    activeHost,
    setActiveHost,
    reposByHost,
    setReposForHost,
    clearReposForHost,
    clearAllRepos,
    logout,
  } = usePrContext();

  const mode = search.mode ?? "pull-requests";
  const [searchQuery, setSearchQuery] = useState("");

  const authenticatedHosts = useMemo(
    () => HOSTS.filter((host) => authByHost[host]),
    [authByHost],
  );

  const repoPrsQuery = useQuery({
    queryKey: ["repo-prs", reposByHost, authByHost],
    queryFn: () =>
      fetchRepoPullRequestsByHost({
        hosts: authenticatedHosts,
        reposByHost,
      }),
    enabled: authenticatedHosts.length > 0,
  });

  const groupedPullRequests = useMemo(() => {
    const data = repoPrsQuery.data ?? [];
    return data
      .map(({ repo, pullRequests }) => ({
        host: repo.host,
        repo,
        pullRequests: [...pullRequests].sort((a, b) => b.id - a.id),
      }))
      .sort((a, b) => {
        if (a.host !== b.host) return a.host.localeCompare(b.host);
        return a.repo.fullName.localeCompare(b.repo.fullName);
      });
  }, [repoPrsQuery.data]);

  const pullRequestsByRepo = useMemo(() => {
    const map = new Map<string, PullRequestSummary[]>();
    for (const item of groupedPullRequests) {
      map.set(`${item.host}:${item.repo.fullName}`, item.pullRequests);
    }
    return map;
  }, [groupedPullRequests]);

  const pullRequestTree = useMemo(
    () => buildPullRequestTree(reposByHost, pullRequestsByRepo, searchQuery),
    [reposByHost, pullRequestsByRepo, searchQuery],
  );

  useEffect(() => {
    if (mode !== "pull-requests") return;
    tree.setTree(pullRequestTree.root);
    tree.setKinds(new Map());
    if (
      !tree.activeFile ||
      !pullRequestTree.pullRequestMeta.has(tree.activeFile)
    ) {
      tree.setActiveFile(undefined);
    }
  }, [mode, pullRequestTree, tree]);

  const selectedRepoCount =
    reposByHost.bitbucket.length + reposByHost.github.length;

  return (
    <div className="h-full min-h-0 flex bg-background">
      <aside
        data-component="sidebar"
        className="w-[300px] shrink-0 border-r border-border bg-sidebar flex flex-col"
      >
        <div
          data-component="top-sidebar"
          className="h-11 px-2 border-b border-border flex items-center gap-1"
        >
          <Button
            type="button"
            variant={mode === "hosts" ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              setSearchQuery("");
              navigate({ to: "/", search: { mode: "hosts" } });
            }}
            aria-label="Host settings"
          >
            <Settings2 className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant={mode === "repositories" ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              setSearchQuery("");
              navigate({ to: "/", search: { mode: "repositories" } });
            }}
            aria-label="Repository selection"
          >
            <FolderGit className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant={mode === "pull-requests" ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              setSearchQuery("");
              navigate({ to: "/", search: { mode: "pull-requests" } });
            }}
            aria-label="Pull requests"
          >
            <GitPullRequest className="size-3.5" />
          </Button>
        </div>

        <div
          data-component="search-sidebar"
          className="h-10 pl-2 pr-2 border-b border-border flex items-center gap-2"
        >
          {mode === "pull-requests" ? (
            <Input
              className="h-7 text-[12px] border-0 focus-visible:ring-0"
              placeholder="search repos or pull requests"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          ) : (
            <span className="text-[11px] text-muted-foreground px-1">
              Select host
            </span>
          )}
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto px-1 py-1"
          data-component="tree"
        >
          {mode === "pull-requests" ? (
            pullRequestTree.root.length === 0 ? (
              <div className="px-2 py-3 text-[12px] text-muted-foreground">
                No repositories or pull requests match.
              </div>
            ) : (
              <FileTree
                path=""
                filterQuery={searchQuery}
                onFileClick={(node) => {
                  const meta = pullRequestTree.pullRequestMeta.get(node.path);
                  if (!meta) return;
                  setActiveHost(meta.host);
                  if (meta.host === "github") {
                    navigate({
                      to: "/$workspace/$repo/pull/$pullRequestId",
                      params: {
                        workspace: meta.workspace,
                        repo: meta.repo,
                        pullRequestId: meta.pullRequestId,
                      },
                    });
                    return;
                  }
                  navigate({
                    to: "/$workspace/$repo/pull-requests/$pullRequestId",
                    params: {
                      workspace: meta.workspace,
                      repo: meta.repo,
                      pullRequestId: meta.pullRequestId,
                    },
                  });
                }}
              />
            )
          ) : (
            <HostTree activeHost={activeHost} onSelect={setActiveHost} />
          )}
        </div>
      </aside>

      <section className="flex-1 min-w-0 min-h-0 flex flex-col">
        <header
          data-component="navbar"
          className="h-11 border-b border-border bg-card px-3 flex items-center gap-2 text-[12px]"
        >
          <span className="text-muted-foreground">
            {mode === "pull-requests"
              ? "Open Pull Requests"
              : mode === "repositories"
                ? "Repository Selection"
                : "Host Settings"}
          </span>
          <span className="ml-auto text-muted-foreground">
            {selectedRepoCount} selected repos
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ["repo-prs"] });
            }}
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              if (
                !window.confirm(
                  "Disconnect all hosts and clear stored credentials?",
                )
              ) {
                return;
              }
              void (async () => {
                clearAllRepos();
                await logout();
                await queryClient.invalidateQueries({ queryKey: ["repo-prs"] });
                navigate({ to: "/" });
              })();
            }}
          >
            Disconnect All
          </Button>
        </header>

        <main
          data-component="diff-view"
          className="flex-1 min-h-0 overflow-y-auto p-4"
        >
          {mode === "hosts" ? (
            <div className="max-w-2xl space-y-3">
              <div className="text-[13px] text-muted-foreground">
                Connect hosts for pull request read and write actions.
              </div>
              <HostAuthPanel host={activeHost} />
            </div>
          ) : mode === "repositories" ? (
            <div className="max-w-3xl space-y-4">
              {authByHost[activeHost] ? (
                <>
                  <RepositorySelector
                    host={activeHost}
                    initialSelected={reposByHost[activeHost]}
                    saveLabel="Save Selection"
                    onSave={(nextRepos) => {
                      setReposForHost(activeHost, nextRepos);
                      void queryClient.invalidateQueries({
                        queryKey: ["repo-prs"],
                      });
                      navigate({ to: "/", search: { mode: "pull-requests" } });
                    }}
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        clearReposForHost(activeHost);
                        void queryClient.invalidateQueries({
                          queryKey: ["repo-prs"],
                        });
                      }}
                    >
                      Clear {getHostLabel(activeHost)} repositories
                    </Button>
                  </div>
                </>
              ) : (
                <div className="border border-border bg-card p-4 space-y-3 text-[13px]">
                  <div className="text-muted-foreground">
                    {getHostLabel(activeHost)} is not connected.
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate({ to: "/", search: { mode: "hosts" } })
                    }
                  >
                    Open Host Settings
                  </Button>
                </div>
              )}
            </div>
          ) : selectedRepoCount === 0 ? (
            <div className="border border-border bg-card p-8 text-center space-y-3 max-w-2xl">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <FolderGit className="size-4" />
                <span className="text-[13px]">No repositories selected.</span>
              </div>
              <Button
                onClick={() =>
                  navigate({ to: "/", search: { mode: "repositories" } })
                }
              >
                Select Repositories
              </Button>
            </div>
          ) : repoPrsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
              <Loader2 className="size-4 animate-spin" />
              <span>Loading pull requests...</span>
            </div>
          ) : repoPrsQuery.error ? (
            <div className="border border-destructive bg-destructive/10 p-4 text-destructive text-[13px] max-w-2xl">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4" />
                <span>
                  [ERROR]{" "}
                  {repoPrsQuery.error instanceof Error
                    ? repoPrsQuery.error.message
                    : "Failed to load pull requests"}
                </span>
              </div>
            </div>
          ) : groupedPullRequests.every(
              (entry) => entry.pullRequests.length === 0,
            ) ? (
            <div className="border border-border bg-card p-8 text-center space-y-3 max-w-2xl">
              <p className="text-[13px] text-muted-foreground">
                No pull requests in selected repositories.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  navigate({ to: "/", search: { mode: "repositories" } })
                }
              >
                Manage Repositories
              </Button>
            </div>
          ) : (
            <div className="border border-border bg-card max-w-4xl">
              <div className="divide-y divide-border">
                {groupedPullRequests
                  .filter((entry) => entry.pullRequests.length > 0)
                  .map(({ host, repo, pullRequests }) => (
                    <div key={`${host}:${repo.fullName}`} className="p-3">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-2">
                        <span className="px-1 py-0.5 border border-border bg-secondary">
                          {getHostLabel(host)}
                        </span>
                        <span className="font-mono">{repo.fullName}</span>
                      </div>
                      <div className="space-y-1">
                        {pullRequests.map((pr) => (
                          <button
                            type="button"
                            key={`${host}:${repo.fullName}-${pr.id}`}
                            className="w-full text-left border border-border px-3 py-2 text-[13px] hover:bg-accent transition-colors bg-background"
                            onClick={() => {
                              if (repo.host === "github") {
                                navigate({
                                  to: "/$workspace/$repo/pull/$pullRequestId",
                                  params: {
                                    workspace: repo.workspace,
                                    repo: repo.repo,
                                    pullRequestId: String(pr.id),
                                  },
                                });
                                return;
                              }
                              navigate({
                                to: "/$workspace/$repo/pull-requests/$pullRequestId",
                                params: {
                                  workspace: repo.workspace,
                                  repo: repo.repo,
                                  pullRequestId: String(pr.id),
                                },
                              });
                            }}
                          >
                            <div className="font-medium truncate text-foreground">
                              {pr.title}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              #{pr.id} -{" "}
                              {pr.author?.display_name ?? "Unknown author"}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
