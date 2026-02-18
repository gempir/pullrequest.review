const DIRECTORY_STATE_KEY_PREFIX = "review_directory_state:v1";

export function makeDirectoryStateStorageKey(workspace: string, repo: string, pullRequestId: string) {
    return `${DIRECTORY_STATE_KEY_PREFIX}:${workspace}/${repo}/${pullRequestId}`;
}
