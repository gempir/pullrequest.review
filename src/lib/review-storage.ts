const DIRECTORY_STATE_KEY_PREFIX = "pr_review_directory_state";

export function makeDirectoryStateStorageKey(
  workspace: string,
  repo: string,
  pullRequestId: string,
) {
  return `${DIRECTORY_STATE_KEY_PREFIX}:${workspace}/${repo}/${pullRequestId}`;
}
