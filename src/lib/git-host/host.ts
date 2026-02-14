import type { GitHost } from "@/lib/git-host/types";

export const GIT_HOSTS: readonly GitHost[] = ["bitbucket", "github"];

export function isGitHost(value: string): value is GitHost {
  return value === "bitbucket" || value === "github";
}

export function getGitHostLabel(host: GitHost) {
  return host === "bitbucket" ? "Bitbucket" : "GitHub";
}

export function getGitHostDomain(host: GitHost) {
  return host === "github" ? "github.com" : "bitbucket.org";
}
