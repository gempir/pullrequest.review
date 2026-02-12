import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  FolderGit,
  GitPullRequest,
  Loader2,
  Settings2,
} from "lucide-react";
import { fetchBitbucketRepoPullRequests } from "@/lib/bitbucket-api";
import { usePrContext } from "@/lib/pr-context";
import { RepositorySelector } from "@/components/repository-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, repos, setRepos, clearRepos, logout } =
    usePrContext();
  const [manageReposOpen, setManageReposOpen] = useState(false);

  const repoPrsQuery = useQuery({
    queryKey: ["bitbucket-repo-prs", repos, isAuthenticated],
    queryFn: () => fetchBitbucketRepoPullRequests({ repos }),
    enabled: isAuthenticated && repos.length > 0,
  });

  const groupedPullRequests = useMemo(() => {
    const data = repoPrsQuery.data ?? [];
    return data
      .map(({ repo, pullRequests }) => ({
        repo,
        pullRequests: [...pullRequests].sort((a, b) => b.id - a.id),
      }))
      .filter(({ pullRequests }) => pullRequests.length > 0)
      .sort((a, b) => a.repo.fullName.localeCompare(b.repo.fullName));
  }, [repoPrsQuery.data]);

  const selectedRepoCount = repos.length;

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
            onClick={() => setManageReposOpen(true)}
          >
            <Settings2 className="size-3.5" />
            Manage Repositories
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              if (!window.confirm("Disconnect and clear stored credentials?")) {
                return;
              }
              void (async () => {
                clearRepos();
                await logout();
                await queryClient.invalidateQueries({
                  queryKey: ["bitbucket-repo-prs"],
                });
                navigate({ to: "/" });
              })();
            }}
          >
            Disconnect
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {repos.length === 0 ? (
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
                {groupedPullRequests.map(({ repo, pullRequests }) => (
                  <div key={repo.fullName} className="p-3">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-2">
                      <span className="font-mono">{repo.fullName}</span>
                    </div>
                    <div className="space-y-1">
                      {pullRequests.map((pr) => (
                        <button
                          type="button"
                          key={`${repo.fullName}-${pr.id}`}
                          className="w-full text-left border border-border px-3 py-2 text-[13px] hover:bg-accent transition-colors bg-card"
                          onClick={() => {
                            navigate({
                              to: "/$workspace/$repo/pull-requests/$pullRequestId",
                              params: {
                                workspace: repo.workspace,
                                repo: repo.slug,
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

          <div className="p-4 overflow-auto">
            <RepositorySelector
              initialSelected={repos}
              saveLabel="Save Selection"
              onCancel={() => setManageReposOpen(false)}
              onSave={(nextRepos) => {
                setRepos(nextRepos);
                setManageReposOpen(false);
                void queryClient.invalidateQueries({
                  queryKey: ["bitbucket-repo-prs"],
                });
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
