import { getHostCapabilities, getHostClient } from "@/lib/git-host/registry";
import type { GitHost, PullRequestRef, RepoRef } from "@/lib/git-host/types";

export async function fetchRepoPullRequestsByHost(data: {
  hosts: GitHost[];
  reposByHost: Record<GitHost, RepoRef[]>;
}) {
  const results = await Promise.all(
    data.hosts.map(async (host) => {
      const repos = data.reposByHost[host] ?? [];
      if (!repos.length)
        return [] as Array<{
          repo: RepoRef;
          pullRequests: {
            id: number;
            title: string;
            state: string;
            links?: { html?: { href?: string } };
            author?: { displayName?: string };
          }[];
        }>;
      const client = getHostClient(host);
      return client.listPullRequestsForRepos({ repos });
    }),
  );

  return results.flat();
}

export async function listRepositoriesForHost(data: { host: GitHost }) {
  return getHostClient(data.host).listRepositories();
}

export async function fetchPullRequestBundleByRef(data: {
  prRef: PullRequestRef;
}) {
  return getHostClient(data.prRef.host).fetchPullRequestBundleByRef(data);
}

export async function approvePullRequest(data: { prRef: PullRequestRef }) {
  return getHostClient(data.prRef.host).approvePullRequest(data);
}

export async function requestChangesOnPullRequest(data: {
  prRef: PullRequestRef;
  body?: string;
}) {
  return getHostClient(data.prRef.host).requestChanges(data);
}

export async function mergePullRequest(data: {
  prRef: PullRequestRef;
  closeSourceBranch?: boolean;
  message?: string;
  mergeStrategy?: string;
}) {
  return getHostClient(data.prRef.host).mergePullRequest(data);
}

export async function createPullRequestComment(data: {
  prRef: PullRequestRef;
  content: string;
  inline?: { path: string; to?: number; from?: number };
  parentId?: number;
}) {
  return getHostClient(data.prRef.host).createPullRequestComment(data);
}

export async function resolvePullRequestComment(data: {
  prRef: PullRequestRef;
  commentId: number;
  resolve: boolean;
}) {
  return getHostClient(data.prRef.host).resolvePullRequestComment(data);
}

export function getCapabilitiesForHost(host: GitHost) {
  return getHostCapabilities(host);
}

export async function getAuthStateForHost(host: GitHost) {
  return getHostClient(host).getAuthState();
}

export async function loginToHost(
  data:
    | { host: "bitbucket"; email: string; apiToken: string }
    | { host: "github"; token: string },
) {
  return getHostClient(data.host).login(data);
}

export async function logoutHost(data: { host: GitHost }) {
  return getHostClient(data.host).logout();
}

export function getHostLabel(host: GitHost) {
  return host === "bitbucket" ? "Bitbucket" : "GitHub";
}
