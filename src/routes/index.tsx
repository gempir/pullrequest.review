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
  }, [data, fileTree]);

  useEffect(() => {
    if (!prUrl) {
      fileTree.reset();
    }
  }, [prUrl, fileTree]);

  if (!prUrl) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="w-full max-w-3xl space-y-6 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">Load a Pull Request</h2>
            <p className="text-sm text-muted-foreground">
              Enter a Bitbucket Cloud pull request URL to review.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
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
              className="h-9 text-sm"
            />
            <Button
              onClick={() => {
                const trimmed = prInput.trim();
                if (trimmed) setPrUrl(trimmed);
              }}
              className="h-9 text-sm"
            >
              Load PR
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Open Pull Requests</h3>
              <span className="text-xs text-muted-foreground">
                {repos.length} repositories
              </span>
            </div>
            {repoPrsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading pull requests...</p>
            ) : repoPrsQuery.error ? (
              <p className="text-sm text-destructive">
                {repoPrsQuery.error instanceof Error
                  ? repoPrsQuery.error.message
                  : "Failed to load pull requests"}
              </p>
            ) : (
              <div className="h-80 rounded-md border overflow-auto">
                <div className="p-3 space-y-3">
                  {(repoPrsQuery.data ?? []).map(({ repo, pullRequests }) => (
                    <div key={repo.fullName} className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        {repo.fullName}
                      </div>
                      {pullRequests.length === 0 ? (
                        <div className="text-xs text-muted-foreground">
                          No open pull requests.
                        </div>
                      ) : (
                        pullRequests.map((pr) => (
                          <button
                            key={`${repo.fullName}-${pr.id}`}
                            className="w-full text-left rounded-md border px-3 py-2 text-sm hover:bg-accent"
                            onClick={() => {
                              const href = pr.links?.html?.href;
                              if (href) setPrUrl(href);
                            }}
                          >
                            <div className="font-medium truncate">{pr.title}</div>
                            <div className="text-xs text-muted-foreground">
                              #{pr.id} · {pr.author?.display_name ?? "Unknown author"}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground">Loading pull request...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-destructive">
          Error: {error instanceof Error ? error.message : "Failed to load pull request"}
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 space-y-4">
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
  );
}
