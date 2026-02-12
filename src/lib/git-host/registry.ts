import { bitbucketClient } from "@/lib/git-host/providers/bitbucket";
import { githubClient } from "@/lib/git-host/providers/github";
import type {
  GitHost,
  GitHostClient,
  HostCapabilities,
} from "@/lib/git-host/types";

const clients: Record<GitHost, GitHostClient> = {
  bitbucket: bitbucketClient,
  github: githubClient,
};

export function getHostClient(host: GitHost): GitHostClient {
  return clients[host];
}

export function listHostClients(): GitHostClient[] {
  return [clients.bitbucket, clients.github];
}

export async function listConfiguredHosts(): Promise<GitHost[]> {
  const states = await Promise.all(
    listHostClients().map(async (client) => ({
      host: client.host,
      state: await client.getAuthState(),
    })),
  );
  return states
    .filter(({ state }) => state.authenticated)
    .map(({ host }) => host);
}

export function getHostCapabilities(host: GitHost): HostCapabilities {
  return clients[host].capabilities;
}
