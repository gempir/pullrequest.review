import { encodeFilePath, mapWithConcurrency, REPO_PULL_REQUEST_LIST_LIMIT } from "@/lib/git-host/shared/http";
import { withBitbucketSuggestionTrailer } from "@/lib/git-host/suggestions";
import { type GitHostClient, HostApiError, type PullRequestRef, type RepoRef } from "@/lib/git-host/types";
import { clearBitbucketAuthCredential, writeBitbucketAuthCredential, writeBitbucketOAuthCredential } from "@/lib/storage";
import { API_BASE, basicAuthorization, fetchAllPages, pullRequestUrl, readCredentials, repoUrl, request, requestJson, requestWith, sendJson } from "./api";
import {
    currentUserReviewStatus,
    mapBuildStatuses,
    mapComment,
    mapCommit,
    mapDiffStat,
    mapHistory,
    mapInlineCommentPayload,
    mapPullRequest,
    mapPullRequestSummary,
    mapRepo,
    mapReviewers,
} from "./mappers";
import type {
    BitbucketActivityEntry,
    BitbucketBuildStatus,
    BitbucketCommentRaw,
    BitbucketCommitRaw,
    BitbucketDiffStatEntryRaw,
    BitbucketPullRequestRaw,
    BitbucketPullRequestSummaryRaw,
    BitbucketRepoEntry,
    BitbucketUser,
    BitbucketWorkspaceEntry,
} from "./raw-types";

const PULL_REQUEST_STATES = ["OPEN", "MERGED", "DECLINED", "SUPERSEDED"].map((state) => `state=${state}`).join("&");

async function fetchText(url: string) {
    return (await request(url, { headers: { Accept: "text/plain" } })).text();
}

async function fetchDiffStat(url: string) {
    return (await fetchAllPages<BitbucketDiffStatEntryRaw>(url)).map(mapDiffStat);
}

async function fetchLatestBuildStatuses(prRef: PullRequestRef) {
    const latestCommit = await requestJson<{ values?: BitbucketCommitRaw[] }>(pullRequestUrl(prRef, "/commits?pagelen=1"));
    const hash = latestCommit.values?.[0]?.hash?.trim();
    if (!hash) return [];
    return fetchAllPages<BitbucketBuildStatus>(repoUrl(prRef, `/commit/${hash}/statuses?pagelen=100`));
}

async function listRepositoriesForWorkspace(workspace: string) {
    return fetchAllPages<BitbucketRepoEntry>(`${API_BASE}/repositories/${workspace}?role=member&pagelen=100`);
}

export const bitbucketClient: GitHostClient = {
    host: "bitbucket",
    label: "Bitbucket",
    capabilities: {
        publicReadSupported: false,
        supportsThreadResolution: true,
        supportsNestedReplies: true,
        requestChangesAvailable: true,
        removeApprovalAvailable: true,
        declineAvailable: true,
        markDraftAvailable: true,
    },
    isAuthenticated() {
        return Boolean(readCredentials());
    },
    async login(credentials) {
        if (credentials.host !== "bitbucket") throw new Error("Bitbucket credentials expected");
        if ("accessToken" in credentials) {
            const accessToken = credentials.accessToken.trim();
            if (!accessToken) throw new Error("Bitbucket OAuth access token is required");
            await requestWith(`${API_BASE}/user`, `Bearer ${accessToken}`, {}, "Bitbucket OAuth authentication");
            await writeBitbucketOAuthCredential({
                accessToken,
                refreshToken: credentials.refreshToken?.trim() || undefined,
                expiresAt: credentials.expiresAt,
            });
            return;
        }
        const email = credentials.email.trim();
        const apiToken = credentials.apiToken.trim();
        if (!email) throw new Error("Email is required");
        if (!apiToken) throw new Error("API token is required");
        await requestWith(`${API_BASE}/user`, basicAuthorization(email, apiToken), {}, "Bitbucket authentication");
        await writeBitbucketAuthCredential({ email, apiToken });
    },
    logout() {
        clearBitbucketAuthCredential();
    },
    async listRepositories() {
        const workspaces = await fetchAllPages<BitbucketWorkspaceEntry>(`${API_BASE}/user/workspaces?pagelen=100`);
        const slugs = workspaces.flatMap((entry) => entry.workspace?.slug ?? []);
        const repositories = (await mapWithConcurrency(slugs, 4, listRepositoriesForWorkspace)).flat();
        const byFullName = new Map<string, RepoRef>();
        for (const repo of repositories.map(mapRepo)) {
            if (repo) byFullName.set(repo.fullName, repo);
        }
        return Array.from(byFullName.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
    },
    async listPullRequestsForRepos({ repos }) {
        return mapWithConcurrency(repos, 4, async (repo) => {
            const url = repoUrl(repo, `/pullrequests?${PULL_REQUEST_STATES}&pagelen=50&sort=-updated_on`);
            const pullRequests = await fetchAllPages<BitbucketPullRequestSummaryRaw>(url, REPO_PULL_REQUEST_LIST_LIMIT);
            return { repo, pullRequests: pullRequests.map(mapPullRequestSummary) };
        });
    },
    async fetchPullRequestCritical({ prRef }) {
        const [pr, diff, diffstat, commits] = await Promise.all([
            requestJson<BitbucketPullRequestRaw>(pullRequestUrl(prRef)),
            fetchText(pullRequestUrl(prRef, "/diff")),
            fetchDiffStat(pullRequestUrl(prRef, "/diffstat?pagelen=100")),
            fetchAllPages<BitbucketCommitRaw>(pullRequestUrl(prRef, "/commits?pagelen=50")),
        ]);
        return { pr: mapPullRequest(pr), diff, diffstat, commits: commits.map(mapCommit) };
    },
    async fetchPullRequestDeferred({ prRef }) {
        // Activity, the current user and build statuses are optional extras; a failure there must not hide reviewers.
        const [rawPr, activity, currentUser, buildStatuses] = await Promise.all([
            requestJson<BitbucketPullRequestRaw>(pullRequestUrl(prRef)),
            fetchAllPages<BitbucketActivityEntry>(pullRequestUrl(prRef, "/activity?pagelen=50")).catch(() => []),
            requestJson<BitbucketUser>(`${API_BASE}/user`).catch(() => null),
            fetchLatestBuildStatuses(prRef).catch(() => []),
        ]);
        return {
            history: mapHistory(activity),
            reviewers: mapReviewers(rawPr, activity),
            buildStatuses: mapBuildStatuses(buildStatuses),
            currentUser: currentUser ? { displayName: currentUser.display_name, avatarUrl: currentUser.links?.avatar?.href } : undefined,
            currentUserReviewStatus: currentUserReviewStatus(rawPr, currentUser),
        };
    },
    async fetchPullRequestComments({ prRef }) {
        const comments = await fetchAllPages<BitbucketCommentRaw>(pullRequestUrl(prRef, "/comments?pagelen=100&sort=created_on"));
        return comments.map(mapComment);
    },
    async approvePullRequest({ prRef }) {
        await sendJson(pullRequestUrl(prRef, "/approve"), "POST");
    },
    async removePullRequestApproval({ prRef }) {
        await sendJson(pullRequestUrl(prRef, "/approve"), "DELETE");
    },
    async requestChanges({ prRef }) {
        await sendJson(pullRequestUrl(prRef, "/request-changes"), "POST");
    },
    async declinePullRequest({ prRef }) {
        await sendJson(pullRequestUrl(prRef, "/decline"), "POST");
    },
    async markPullRequestAsDraft({ prRef }) {
        await sendJson(pullRequestUrl(prRef), "PUT", { draft: true });
    },
    async markPullRequestReady({ prRef }) {
        await sendJson(pullRequestUrl(prRef), "PUT", { draft: false });
    },
    async mergePullRequest({ prRef, closeSourceBranch, message, mergeStrategy }) {
        await sendJson(pullRequestUrl(prRef, "/merge"), "POST", {
            close_source_branch: Boolean(closeSourceBranch),
            ...(message?.trim() ? { message: message.trim() } : {}),
            ...(mergeStrategy?.trim() ? { merge_strategy: mergeStrategy.trim() } : {}),
        });
    },
    async updatePullRequestDescription({ prRef, description, title }) {
        await sendJson(pullRequestUrl(prRef), "PUT", { description, ...(title ? { title } : {}) });
    },
    async createPullRequestComment({ prRef, content, inline, parentId }) {
        await sendJson(pullRequestUrl(prRef, "/comments"), "POST", {
            content: { raw: withBitbucketSuggestionTrailer(content) },
            ...(inline ? { inline: mapInlineCommentPayload(inline) } : {}),
            ...(parentId ? { parent: { id: parentId } } : {}),
        });
    },
    async updatePullRequestComment({ prRef, comment, content }) {
        await sendJson(pullRequestUrl(prRef, `/comments/${comment.id}`), "PUT", { content: { raw: content } });
    },
    async resolvePullRequestComment({ prRef, comment, resolve }) {
        await sendJson(pullRequestUrl(prRef, `/comments/${comment.id}/${resolve ? "resolve" : "unresolve"}`), "POST");
    },
    async deletePullRequestComment({ prRef, comment }) {
        await sendJson(pullRequestUrl(prRef, `/comments/${comment.id}`), "DELETE");
    },
    async fetchFileContents({ prRef, commit, path }) {
        const encodedPath = encodeFilePath(path);
        if (!encodedPath) return "";
        try {
            const res = await request(repoUrl(prRef, `/src/${commit}/${encodedPath}`), { headers: { Accept: "application/octet-stream" } });
            return await res.text();
        } catch (error) {
            if (error instanceof HostApiError && error.status === 404) return "";
            throw error;
        }
    },
    async fetchCommitRangeDiff({ prRef, baseCommitHash, headCommitHash }) {
        // Bitbucket's revspec reads "<source>..<destination>", the opposite of git diff, so base -> head is requested as head..base.
        const rangeSpec = `${encodeURIComponent(headCommitHash)}..${encodeURIComponent(baseCommitHash)}`;
        const [diff, diffstat] = await Promise.all([
            fetchText(repoUrl(prRef, `/diff/${rangeSpec}`)),
            fetchDiffStat(repoUrl(prRef, `/diffstat/${rangeSpec}?pagelen=100`)),
        ]);
        return { diff, diffstat };
    },
};
