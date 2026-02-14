import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  approvePullRequest,
  mergePullRequest,
  requestChangesOnPullRequest,
} from "@/lib/git-host/service";
import type { PullRequestRef } from "@/lib/git-host/types";

interface UseReviewActionsProps {
  prRef?: PullRequestRef;
  queryKey: readonly unknown[];
}

export function useReviewActions({ prRef, queryKey }: UseReviewActionsProps) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: [...queryKey] });
  };

  const approve = useMutation({
    mutationFn: async () => {
      if (!prRef) throw new Error("Pull request reference is missing");
      return approvePullRequest({ prRef });
    },
    onSuccess: invalidate,
  });

  const requestChanges = useMutation({
    mutationFn: async () => {
      if (!prRef) throw new Error("Pull request reference is missing");
      return requestChangesOnPullRequest({ prRef });
    },
    onSuccess: invalidate,
  });

  const merge = useMutation({
    mutationFn: async (payload: {
      message?: string;
      mergeStrategy?: string;
      closeSourceBranch?: boolean;
    }) => {
      if (!prRef) throw new Error("Pull request reference is missing");
      return mergePullRequest({ prRef, ...payload });
    },
    onSuccess: invalidate,
  });

  return { approve, requestChanges, merge };
}
