import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { usePrContext } from "@/lib/pr-context";
import { useDiffOptions, toLibraryOptions } from "@/lib/diff-options-context";
import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { useEffect, useMemo } from "react";
import {
  buildKindMapForTree,
  buildTreeFromPaths,
  useFileTree,
  type ChangeKind,
} from "@/lib/file-tree-context";
import { fileAnchorId } from "@/lib/file-anchors";

interface BitbucketAuthPayload {
  accessToken: string;
}

interface BitbucketPullRequestData {
  prUrl: string;
  auth?: BitbucketAuthPayload | null;
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
  const { prUrl, auth } = usePrContext();
  const { options } = useDiffOptions();
  const libOptions = toLibraryOptions(options);
  const fileTree = useFileTree();

  const { data, isLoading, error } = useQuery({
    queryKey: ["bitbucket-pr", prUrl, auth?.accessToken],
    queryFn: () => fetchBitbucketPullRequest({ data: { prUrl, auth } }),
    enabled: Boolean(prUrl),
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
        <p className="text-muted-foreground">
          Paste a Bitbucket Cloud pull request URL in the header and click Load PR.
        </p>
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
