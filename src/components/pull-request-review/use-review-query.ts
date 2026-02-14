import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  fetchPullRequestBundleByRef,
  getCapabilitiesForHost,
} from "@/lib/git-host/service";
import { type GitHost, HostApiError } from "@/lib/git-host/types";

interface UseReviewQueryProps {
  host: GitHost;
  workspace: string;
  repo: string;
  pullRequestId: string;
  canRead: boolean;
  canWrite: boolean;
  onRequireAuth?: (reason: "rate_limit") => void;
}

export function isRateLimitedError(error: unknown) {
  if (!error) return false;
  if (error instanceof HostApiError) {
    return error.status === 429 || error.status === 403;
  }
  if (error instanceof Error) {
    return error.message.includes("429") || error.message.includes("403");
  }
  return false;
}

export function useReviewQuery({
  host,
  workspace,
  repo,
  pullRequestId,
  canRead,
  canWrite,
  onRequireAuth,
}: UseReviewQueryProps) {
  const hostCapabilities = useMemo(() => getCapabilitiesForHost(host), [host]);
  const queryKey = useMemo(
    () => ["pr-bundle", host, workspace, repo, pullRequestId] as const,
    [host, pullRequestId, repo, workspace],
  );

  const query = useQuery({
    queryKey,
    queryFn: () =>
      fetchPullRequestBundleByRef({
        prRef: {
          host,
          workspace,
          repo,
          pullRequestId,
        },
      }),
    enabled: canRead || hostCapabilities.publicReadSupported,
  });

  const hasPendingBuildStatuses =
    query.data?.buildStatuses?.some((status) => status.state === "pending") ??
    false;

  useEffect(() => {
    if (!hasPendingBuildStatuses) return;
    const intervalId = window.setInterval(() => {
      if (query.isFetching) return;
      void query.refetch();
    }, 10_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasPendingBuildStatuses, query]);

  useEffect(() => {
    if (!query.error || canWrite || !isRateLimitedError(query.error)) return;
    onRequireAuth?.("rate_limit");
  }, [canWrite, onRequireAuth, query.error]);

  return {
    hostCapabilities,
    queryKey,
    query,
    hasPendingBuildStatuses,
  };
}
