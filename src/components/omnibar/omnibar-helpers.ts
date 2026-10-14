import type { SortedRootPullRequest } from "@/features/landing/model/landing-model";

export const OMNIBAR_ITEM_CLASS_NAME =
    "flex min-h-9 cursor-default select-none items-center gap-2 px-2 text-[12px] text-foreground outline-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-45 data-[selected=true]:bg-selection";

export const OMNIBAR_GROUP_CLASS_NAME =
    "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground";

export function getPullRequestOmnibarKeywords(row: SortedRootPullRequest) {
    const { pullRequest, repo, host } = row;
    return [
        String(pullRequest.id),
        `#${pullRequest.id}`,
        pullRequest.title,
        repo.fullName,
        repo.workspace,
        repo.repo,
        host,
        pullRequest.state,
        pullRequest.author?.displayName ?? "",
        pullRequest.source?.branch?.name ?? "",
        pullRequest.destination?.branch?.name ?? "",
    ].filter(Boolean);
}

export function getOmnibarFileName(path: string) {
    const separatorIndex = path.lastIndexOf("/");
    return separatorIndex === -1 ? path : path.slice(separatorIndex + 1);
}

export function getOmnibarDirectory(path: string) {
    const separatorIndex = path.lastIndexOf("/");
    return separatorIndex === -1 ? "" : path.slice(0, separatorIndex);
}
