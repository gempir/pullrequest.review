import { makeVersionedStorageKey } from "@/lib/storage/versioned-local-storage";

const DIRECTORY_STATE_KEY_PREFIX_BASE = "pr_review_directory_state";
const DIRECTORY_STATE_KEY_PREFIX = makeVersionedStorageKey(DIRECTORY_STATE_KEY_PREFIX_BASE, 2);

export function makeDirectoryStateStorageKey(workspace: string, repo: string, pullRequestId: string) {
    return `${DIRECTORY_STATE_KEY_PREFIX}:${workspace}/${repo}/${pullRequestId}`;
}
