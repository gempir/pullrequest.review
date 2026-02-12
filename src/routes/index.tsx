import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  FolderGit,
  GitPullRequest,
  Loader2,
  Settings2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { RepositorySelector } from "@/components/repository-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  fetchRepoPullRequestsByHost,
  getHostLabel,
} from "@/lib/git-host/service";
import type { GitHost } from "@/lib/git-host/types";
import { usePrContext } from "@/lib/pr-context";

const HOSTS: GitHost[] = ["bitbucket", "github"];

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function HostTabs({
  activeHost,
  onChange,
}: {
  activeHost: GitHost;
  onChange: (host: GitHost) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {HOSTS.map((host) => (
        <Button
          key={host}
          type="button"
          variant={activeHost === host ? "default" : "outline"}
          onClick={() => onChange(host)}
        >
          {getHostLabel(host)}
        </Button>
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
      <div className="space-y-2">
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

  return (
    <form
      className="space-y-2"
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

function LandingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const [manageReposOpen, setManageReposOpen] = useState(false);
  const [manageHostsOpen, setManageHostsOpen] = useState(false);
  const [repoDialogHost, setRepoDialogHost] = useState<GitHost>(activeHost);
  const [hostDialogHost, setHostDialogHost] = useState<GitHost>(activeHost);

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
      .filter(({ pullRequests }) => pullRequests.length > 0)
      .sort((a, b) => {
        if (a.host !== b.host) return a.host.localeCompare(b.host);
        return a.repo.fullName.localeCompare(b.repo.fullName);
      });
  }, [repoPrsQuery.data]);

  const selectedRepoCount =
    reposByHost.bitbucket.length + reposByHost.github.length;

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="w-full max-w-5xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 flex items-center gap-3 bg-secondary">
          <GitPullRequest className="size-4 text-muted-foreground" />
          <span className="text-[13px] font-medium">Open Pull Requests</span>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {selectedRepoCount} selected repos
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              setRepoDialogHost(activeHost);
              setManageReposOpen(true);
            }}
          >
            <Settings2 className="size-3.5" />
            Manage Repositories
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              setHostDialogHost(activeHost);
              setManageHostsOpen(true);
            }}
          >
            Manage Hosts
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
        </div>

        <div className="p-4 space-y-4">
          {selectedRepoCount === 0 ? (
            <div className="border border-border bg-background p-8 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-3">
                <FolderGit className="size-4" />
                <span className="text-[13px]">No repositories selected.</span>
              </div>
              <Button onClick={() => setManageReposOpen(true)}>
                Manage Repositories
              </Button>
            </div>
          ) : repoPrsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-[13px]">
              <Loader2 className="size-4 animate-spin" />
              <span>Loading pull requests...</span>
            </div>
          ) : repoPrsQuery.error ? (
            <div className="border border-destructive bg-destructive/10 p-4 text-destructive text-[13px]">
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
          ) : groupedPullRequests.length === 0 ? (
            <div className="border border-border bg-background p-8 text-center space-y-3">
              <p className="text-[13px] text-muted-foreground">
                No pull requests in selected repositories.
              </p>
              <Button
                variant="outline"
                onClick={() => setManageReposOpen(true)}
              >
                Manage Repositories
              </Button>
            </div>
          ) : (
            <div className="border border-border bg-background max-h-[70vh] overflow-auto">
              <div className="divide-y divide-border">
                {groupedPullRequests.map(({ host, repo, pullRequests }) => (
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
                          className="w-full text-left border border-border px-3 py-2 text-[13px] hover:bg-accent transition-colors bg-card"
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
                            #{pr.id} ·{" "}
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
        </div>
      </div>

      <Dialog open={manageReposOpen} onOpenChange={setManageReposOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-4 py-3 border-b border-border bg-secondary">
            <DialogTitle className="text-[13px] font-medium">
              Manage Repositories
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 overflow-auto space-y-4">
            <HostTabs
              activeHost={repoDialogHost}
              onChange={(host) => {
                setRepoDialogHost(host);
                setActiveHost(host);
              }}
            />

            {authByHost[repoDialogHost] ? (
              <RepositorySelector
                host={repoDialogHost}
                initialSelected={reposByHost[repoDialogHost]}
                saveLabel="Save Selection"
                onCancel={() => setManageReposOpen(false)}
                onSave={(nextRepos) => {
                  setReposForHost(repoDialogHost, nextRepos);
                  setManageReposOpen(false);
                  void queryClient.invalidateQueries({
                    queryKey: ["repo-prs"],
                  });
                }}
              />
            ) : (
              <div className="border border-border bg-background p-4 text-[13px] text-muted-foreground space-y-2">
                <div>{getHostLabel(repoDialogHost)} is not connected.</div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setHostDialogHost(repoDialogHost);
                    setManageHostsOpen(true);
                  }}
                >
                  Open Host Settings
                </Button>
              </div>
            )}

            {authByHost[repoDialogHost] && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    clearReposForHost(repoDialogHost);
                    void queryClient.invalidateQueries({
                      queryKey: ["repo-prs"],
                    });
                  }}
                >
                  Clear {getHostLabel(repoDialogHost)} Repositories
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manageHostsOpen} onOpenChange={setManageHostsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[13px] font-medium">
              Manage Hosts
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <HostTabs
              activeHost={hostDialogHost}
              onChange={(host) => {
                setHostDialogHost(host);
                setActiveHost(host);
              }}
            />
            <HostAuthPanel host={hostDialogHost} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
