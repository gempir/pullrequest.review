import { bitbucketClient } from "@/lib/git-host/providers/bitbucket";
import { githubClient } from "@/lib/git-host/providers/github";
import type { GitHost, GitHostClient, HostCapabilities } from "@/lib/git-host/types";

const clients: Record<GitHost, GitHostClient> = {
    bitbucket: bitbucketClient,
    github: githubClient,
};

export function getHostClient(host: GitHost): GitHostClient {
    return clients[host];
}

export function getHostCapabilities(host: GitHost): HostCapabilities {
    return clients[host].capabilities;
}
