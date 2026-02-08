import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { usePrContext, type BitbucketRepo } from "@/lib/pr-context";
import { useDiffOptions, toLibraryOptions } from "@/lib/diff-options-context";
import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useEffect, useMemo, useState } from "react";
import {
  buildKindMapForTree,
  buildTreeFromPaths,
  useFileTree,
  type ChangeKind,
} from "@/lib/file-tree-context";
import { fileAnchorId } from "@/lib/file-anchors";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GitPullRequest, Search, AlertCircle, Loader2, FileText } from "lucide-react";

interface BitbucketAuthPayload {
  accessToken: string;
}

interface BitbucketPullRequestData {
  prUrl: string;
  auth?: BitbucketAuthPayload | null;
}

interface BitbucketRepoPullRequestData {
  repos: BitbucketRepo[];
  auth?: BitbucketAuthPayload | null;
}

interface BitbucketPullRequestSummary {
  id: number;
  title: string;
  state: string;
  links?: { html?: { href?: string } };
  author?: { display_name?: string };
}

interface BitbucketPullRequestPage {
  values: BitbucketPullRequestSummary[];
}

interface BitbucketDiffStatEntry {
  status: "added" | "modified" | "removed" | "renamed";
  new?: { path?: string };
  old?: { path?: string };
}

interface BitbucketDiffStatPage {
  values: BitbucketDiffStatEntry[];
  next?: string;
}

const fetchBitbucketPullRequest = createServerFn({
  method: "GET",
}).handler(async ({ data }: { data: BitbucketPullRequestData }) => {
  const url = data.prUrl.trim();
  if (!url) {
    throw new Error("Bitbucket PR URL is required");
  }

  const parsed = parseBitbucketPullRequestUrl(url);
  if (!parsed) {
    throw new Error("Invalid Bitbucket Cloud pull request URL");
  }

  const { workspace, repo, pullRequestId } = parsed;
  const baseApi = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${pullRequestId}`;

  const headers: Record<string, string> = {};
  const token = data.auth?.accessToken?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const diffRes = await fetch(`${baseApi}/diff`, {
    headers: { ...headers, Accept: "text/plain" },
  });
  if (!diffRes.ok) {
    throw new Error(`Failed to fetch diff: ${diffRes.status} ${diffRes.statusText}`);
  }
  const diff = await diffRes.text();

  const diffstat = await fetchAllDiffStat(`${baseApi}/diffstat?pagelen=100`, headers);

  return { diff, diffstat };
});

const fetchBitbucketRepoPullRequests = createServerFn({
  method: "GET",
}).handler(async ({ data }: { data: BitbucketRepoPullRequestData }) => {
  const token = data.auth?.accessToken?.trim();
  if (!token) {
    throw new Error("Access token is required");
  }
  if (!data.repos.length) return [];

  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const results: {
    repo: BitbucketRepo;
    pullRequests: BitbucketPullRequestSummary[];
  }[] = [];

  for (const repo of data.repos) {
    const url = `https://api.bitbucket.org/2.0/repositories/${repo.workspace}/${repo.slug}/pullrequests?pagelen=20`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(
        `Failed to fetch pull requests for ${repo.fullName}: ${res.status} ${res.statusText}`,
      );
    }
    const page = (await res.json()) as BitbucketPullRequestPage;
    results.push({ repo, pullRequests: page.values ?? [] });
  }

  return results;
});

function parseBitbucketPullRequestUrl(prUrl: string): {
  workspace: string;
  repo: string;
  pullRequestId: string;
} | null {
  try {
    const url = new URL(prUrl);
    if (url.hostname !== "bitbucket.org") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 4) return null;
    const [workspace, repo, pullRequests, pullRequestId] = parts;
    if (pullRequests !== "pull-requests") return null;
    if (!/^[0-9]+$/.test(pullRequestId)) return null;
    return { workspace, repo, pullRequestId };
  } catch {
    return null;
  }
}

async function fetchAllDiffStat(
  startUrl: string,
  headers: Record<string, string>,
): Promise<BitbucketDiffStatEntry[]> {
  const values: BitbucketDiffStatEntry[] = [];
  let nextUrl: string | undefined = startUrl;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { ...headers, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch diffstat: ${res.status} ${res.statusText}`);
    }
    const page = (await res.json()) as BitbucketDiffStatPage;
    values.push(...(page.values ?? []));
    nextUrl = page.next;
  }

  return values;
}

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { prUrl, auth, setPrUrl, repos } = usePrContext();
  const { options } = useDiffOptions();
  const libOptions = toLibraryOptions(options);
  const fileTree = useFileTree();
  const [prInput, setPrInput] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["bitbucket-pr", prUrl, auth?.accessToken],
    queryFn: () => fetchBitbucketPullRequest({ data: { prUrl, auth } }),
    enabled: Boolean(prUrl),
  });

  const repoPrsQuery = useQuery({
    queryKey: ["bitbucket-repo-prs", repos, auth?.accessToken],
    queryFn: () => fetchBitbucketRepoPullRequests({ data: { repos, auth } }),
    enabled: Boolean(auth?.accessToken) && repos.length > 0 && !prUrl,
  });

  const fileDiffs = useMemo(() => {
    if (!data) return [];
    const patches = parsePatchFiles(data.diff);
    return patches.flatMap((p) => p.files);
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const paths = data.diffstat
      .map((entry) => entry.new?.path ?? entry.old?.path)
      .filter((path): path is string => Boolean(path));
    const tree = buildTreeFromPaths(paths);
    const fileKinds = new Map<string, ChangeKind>();
    for (const entry of data.diffstat) {
      const path = entry.new?.path ?? entry.old?.path;
      if (!path) continue;
      switch (entry.status) {
        case "added":
          fileKinds.set(path, "add");
          break;
        case "removed":
          fileKinds.set(path, "del");
          break;
        case "modified":
        case "renamed":
          fileKinds.set(path, "mix");
          break;
      }
    }
    const kinds = buildKindMapForTree(tree, fileKinds);
    fileTree.setTree(tree);
    fileTree.setKinds(kinds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!prUrl) {
      fileTree.reset();
    }
  }, [prUrl]);

  // PR List view
  if (!prUrl) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="w-full max-w-3xl border border-border bg-card">
          {/* Header */}
          <div className="border-b border-border px-4 py-3 flex items-center gap-3 bg-secondary">
            <GitPullRequest className="size-4 text-muted-foreground" />
            <span className="text-[13px] font-medium">Load a Pull Request</span>
          </div>
          
          <div className="p-4 space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Enter a Bitbucket Cloud pull request URL to review.
            </p>
            
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="https://bitbucket.org/workspace/repo/pull-requests/123"
                  value={prInput}
                  onChange={(e) => setPrInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const trimmed = prInput.trim();
                      if (trimmed) setPrUrl(trimmed);
                    }
                  }}
                  className="pl-9 font-mono text-xs"
                />
              </div>
              <Button
                onClick={() => {
                  const trimmed = prInput.trim();
                  if (trimmed) setPrUrl(trimmed);
                }}
              >
                Load PR
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-[12px] uppercase tracking-wider text-muted-foreground font-medium">
                  Open Pull Requests
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {repos.length} repositories
                </span>
              </div>
              
              {repoPrsQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-[13px]">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Loading pull requests...</span>
                </div>
              ) : repoPrsQuery.error ? (
                <div className="border border-destructive bg-destructive/10 p-4 text-destructive text-[13px]">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-4" />
                    <span>[ERROR] {repoPrsQuery.error instanceof Error
                      ? repoPrsQuery.error.message
                      : "Failed to load pull requests"}</span>
                  </div>
                </div>
              ) : (
                <div className="border border-border bg-background max-h-80 overflow-auto">
                  <div className="divide-y divide-border">
                    {(repoPrsQuery.data ?? []).map(({ repo, pullRequests }) => (
                      <div key={repo.fullName} className="p-3">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-2">
                          <span className="font-mono">{repo.fullName}</span>
                        </div>
                        {pullRequests.length === 0 ? (
                          <div className="text-[12px] text-muted-foreground py-2">
                            No open pull requests.
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {pullRequests.map((pr) => (
                              <button
                                key={`${repo.fullName}-${pr.id}`}
                                className="w-full text-left border border-border px-3 py-2 text-[13px] hover:bg-accent transition-colors bg-card"
                                onClick={() => {
                                  const href = pr.links?.html?.href;
                                  if (href) setPrUrl(href);
                                }}
                              >
                                <div className="font-medium truncate text-foreground">{pr.title}</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  #{pr.id} · {pr.author?.display_name ?? "Unknown author"}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-[13px]">Loading pull request...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="border border-destructive bg-destructive/10 p-6 max-w-lg">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertCircle className="size-5" />
            <span className="text-[13px] font-medium">[ERROR]</span>
          </div>
          <p className="text-destructive text-[13px]">
            {error instanceof Error ? error.message : "Failed to load pull request"}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Diff view
  return (
    <div className="p-4 space-y-4">
      {/* PR Header */}
      <div className="border border-border bg-card">
        <div className="border-b border-border px-4 py-3 bg-secondary flex items-center gap-3">
          <FileText className="size-4 text-muted-foreground" />
          <span className="text-[12px] uppercase tracking-wider text-muted-foreground font-medium">
            Files Changed
          </span>
          <span className="text-[11px] text-muted-foreground ml-auto">
            {fileDiffs.length} file{fileDiffs.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* File diffs */}
      <div className="space-y-4">
        {fileDiffs.map((fileDiff, i) => {
          const filePath = fileDiff.name ?? fileDiff.prevName ?? String(i);
          const anchorId = fileAnchorId(filePath);
          return (
            <div key={`${filePath}-${i}`} id={anchorId}>
              <FileDiff fileDiff={fileDiff} options={libOptions} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
