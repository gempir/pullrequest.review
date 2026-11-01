import type { RepoRef } from "@/lib/git-host/types";

export function normalizeRepoRef(repo: RepoRef): RepoRef {
    const workspace = repo.workspace.trim();
    const slug = repo.repo.trim();
    return {
        host: repo.host,
        workspace,
        repo: slug,
        fullName: repo.fullName?.trim() || `${workspace}/${slug}`,
        displayName: repo.displayName?.trim() || slug,
    };
}
