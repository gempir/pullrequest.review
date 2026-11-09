import type { GitHost } from "@/lib/git-host/types";

/** Route shape selects the host: each host's pull request URLs mirror the host's own. */
export const PULL_REQUEST_ROUTE = {
    bitbucket: "/$workspace/$repo/pull-requests/$pullRequestId",
    github: "/$workspace/$repo/pull/$pullRequestId",
} as const satisfies Record<GitHost, string>;

const HOST_BY_SEGMENT = new Map(Object.entries(PULL_REQUEST_ROUTE).map(([host, route]) => [route.split("/")[3], host as GitHost]));

/** The host whose pull request route `pathname` is on, if it is on one. */
export function pullRequestRouteHost(pathname: string): GitHost | undefined {
    const [, workspace, repo, segment, pullRequestId] = pathname.split("/");
    return workspace && repo && pullRequestId ? HOST_BY_SEGMENT.get(segment ?? "") : undefined;
}
