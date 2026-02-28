import { type Collection, createCollection, localOnlyCollectionOptions } from "@tanstack/db";
import { rxdbCollectionOptions } from "@tanstack/rxdb-db-collection";
import {
    fetchPullRequestBundleByRef,
    fetchPullRequestCommitRangeDiff,
    fetchPullRequestCriticalByRef,
    fetchPullRequestDeferredByRef,
    fetchPullRequestFileHistory,
    fetchRepoPullRequestsForHost,
    listRepositoriesForHost,
} from "@/lib/git-host/service";
import type {
    Commit,
    GitHost,
    PullRequestBundle,
    PullRequestCommitRangeDiff,
    PullRequestCriticalBundle,
    PullRequestDeferredBundle,
    PullRequestFileHistoryEntry,
    PullRequestHydrationState,
    PullRequestRef,
    PullRequestSummary,
    RepoRef,
} from "@/lib/git-host/types";
import { LruCache } from "@/lib/utils/lru";

export type PullRequestBundleRecord = PullRequestBundle & {
    id: string;
    fetchedAt: number;
    expiresAt: number;
    criticalFetchedAt?: number;
    deferredFetchedAt?: number;
    deferredStatus?: PullRequestHydrationState["deferredStatus"];
};

type PersistedPullRequestBundleRecord = PullRequestBundleRecord;

type PullRequestFileContextRecord = {
    id: string;
    prKey: string;
    path: string;
    oldLines: string[];
    newLines: string[];
    fetchedAt: number;
    expiresAt: number;
};

type PullRequestFileHistoryRecord = {
    id: string;
    prKey: string;
    path: string;
    entries: PullRequestFileHistoryEntry[];
    fetchedAt: number;
    expiresAt: number;
};

export type PullRequestCommitRangeDiffRecord = PullRequestCommitRangeDiff & {
    id: string;
    prKey: string;
    fetchedAt: number;
    expiresAt: number;
};

type PersistedRepoPullRequestRecord = {
    id: string;
    repoKey: string;
    host: GitHost;
    repo: RepoRef;
    pullRequest: PullRequestSummary;
    fetchedAt: number;
    expiresAt: number;
};

type RepositoryRecord = RepoRef & {
    id: string;
    fetchedAt: number;
    expiresAt: number;
};

type ReposByHost = Record<GitHost, RepoRef[]>;

type CollectionUtils = {
    lastError: unknown;
    isFetching: boolean;
    dataUpdatedAt: number;
    refetch: (opts?: { throwOnError?: boolean }) => Promise<void>;
};

type ScopedCollection<T extends object> = {
    collection: Collection<T, string>;
    utils: CollectionUtils;
};

type HostDataCollectionKey =
    | "repositories"
    | "repoPullRequests"
    | "pullRequestBundles"
    | "pullRequestFileContexts"
    | "pullRequestFileHistories"
    | "pullRequestCommitRangeDiffs";
type HostDataRecordMap = {
    repositories: RepositoryRecord;
    repoPullRequests: PersistedRepoPullRequestRecord;
    pullRequestBundles: PersistedPullRequestBundleRecord;
    pullRequestFileContexts: PullRequestFileContextRecord;
    pullRequestFileHistories: PullRequestFileHistoryRecord;
    pullRequestCommitRangeDiffs: PullRequestCommitRangeDiffRecord;
};
type HostDataRecordForKey<K extends HostDataCollectionKey> = HostDataRecordMap[K];
type HostDataCollectionForKey<K extends HostDataCollectionKey> = Collection<HostDataRecordForKey<K>, string>;

type FetchActivity = {
    scopeId: string;
    label: string;
    startedAt: number;
};

type RefetchRegistryEntry = {
    label: string;
    refetch: (opts?: { throwOnError?: boolean }) => Promise<void>;
};

type GitHostFetchActivitySnapshot = {
    activeFetches: FetchActivity[];
    activeFetchCount: number;
    trackedScopeCount: number;
};

export type GitHostDataDebugSnapshot = {
    backendMode: "indexeddb" | "memory";
    cacheTtlMs: number;
    totalRecords: number;
    totalBytes: number;
    lastSweepAt: number | null;
    collections: Record<
        HostDataCollectionKey,
        {
            count: number;
            approxBytes: number;
            oldestFetchedAt: number | null;
            newestFetchedAt: number | null;
            oldestExpiresAt: number | null;
            newestExpiresAt: number | null;
            expiredCount: number;
        }
    >;
};

const HOST_DATA_DATABASE_NAME = "pullrequestdotreview_host_data_v6";
const REPOSITORY_RX_COLLECTION_NAME = "repositories";
const REPO_PULL_REQUEST_RX_COLLECTION_NAME = "repo_pull_requests";
const PULL_REQUEST_BUNDLE_RX_COLLECTION_NAME = "pull_request_bundles";
const PULL_REQUEST_FILE_CONTEXT_RX_COLLECTION_NAME = "pull_request_file_contexts";
const PULL_REQUEST_FILE_HISTORY_RX_COLLECTION_NAME = "pull_request_file_histories";
const PULL_REQUEST_COMMIT_RANGE_DIFF_RX_COLLECTION_NAME = "pull_request_commit_range_diffs";

const REPOSITORY_TANSTACK_COLLECTION_ID = "repos:rxdb";
const REPO_PULL_REQUEST_TANSTACK_COLLECTION_ID = "repo-prs:rxdb";
const PULL_REQUEST_BUNDLE_TANSTACK_COLLECTION_ID = "pr-bundle:rxdb";
const PULL_REQUEST_FILE_CONTEXT_TANSTACK_COLLECTION_ID = "pr-file-contexts:rxdb";
const PULL_REQUEST_FILE_HISTORY_TANSTACK_COLLECTION_ID = "pr-file-histories:rxdb";
const PULL_REQUEST_COMMIT_RANGE_DIFF_TANSTACK_COLLECTION_ID = "pr-commit-range-diffs:rxdb";
const SCOPED_COLLECTION_CACHE_SIZE = 100;
const HOST_DATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUIRED_PERSISTED_COLLECTION_NAMES = [
    REPOSITORY_RX_COLLECTION_NAME,
    REPO_PULL_REQUEST_RX_COLLECTION_NAME,
    PULL_REQUEST_BUNDLE_RX_COLLECTION_NAME,
] as const;
const OPTIONAL_PERSISTED_COLLECTION_NAMES = [
    PULL_REQUEST_FILE_CONTEXT_RX_COLLECTION_NAME,
    PULL_REQUEST_FILE_HISTORY_RX_COLLECTION_NAME,
    PULL_REQUEST_COMMIT_RANGE_DIFF_RX_COLLECTION_NAME,
] as const;

const REPOSITORY_RX_SCHEMA = {
    title: "pullrequestdotreview repositories",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
            maxLength: 400,
        },
        host: {
            type: "string",
            maxLength: 20,
        },
        workspace: {
            type: "string",
            maxLength: 200,
        },
        repo: {
            type: "string",
            maxLength: 200,
        },
        fullName: {
            type: "string",
            maxLength: 500,
        },
        displayName: {
            type: "string",
            maxLength: 500,
        },
        fetchedAt: {
            type: "number",
            minimum: 0,
        },
        expiresAt: {
            type: "number",
            minimum: 0,
        },
    },
    required: ["id", "host", "workspace", "repo", "fullName", "displayName", "fetchedAt", "expiresAt"],
    additionalProperties: false,
} as const;

const REPO_PULL_REQUEST_RX_SCHEMA = {
    title: "pullrequestdotreview repository pull requests",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
            maxLength: 800,
        },
        repoKey: {
            type: "string",
            maxLength: 600,
        },
        host: {
            type: "string",
            maxLength: 20,
        },
        repo: {
            type: "object",
            additionalProperties: true,
        },
        pullRequest: {
            type: "object",
            additionalProperties: true,
        },
        fetchedAt: {
            type: "number",
            minimum: 0,
        },
        expiresAt: {
            type: "number",
            minimum: 0,
        },
    },
    required: ["id", "repoKey", "host", "repo", "pullRequest", "fetchedAt", "expiresAt"],
    additionalProperties: false,
} as const;

const PULL_REQUEST_BUNDLE_RX_SCHEMA = {
    title: "pullrequestdotreview pull request bundles",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
            maxLength: 800,
        },
        prRef: {
            type: "object",
            additionalProperties: true,
        },
        pr: {
            type: "object",
            additionalProperties: true,
        },
        diff: {
            type: "string",
        },
        diffstat: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
        commits: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
        comments: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
        history: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
        reviewers: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
        buildStatuses: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
        fetchedAt: {
            type: "number",
            minimum: 0,
        },
        expiresAt: {
            type: "number",
            minimum: 0,
        },
        criticalFetchedAt: {
            type: ["number", "null"],
        },
        deferredFetchedAt: {
            type: ["number", "null"],
        },
        deferredStatus: {
            type: "string",
            maxLength: 20,
        },
    },
    required: ["id", "prRef", "pr", "diff", "diffstat", "commits", "comments", "fetchedAt", "expiresAt"],
    additionalProperties: false,
} as const;

const PULL_REQUEST_FILE_CONTEXT_RX_SCHEMA = {
    title: "pullrequestdotreview pull request file contexts",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
            maxLength: 1300,
        },
        prKey: {
            type: "string",
            maxLength: 800,
        },
        path: {
            type: "string",
            maxLength: 1000,
        },
        oldLines: {
            type: "array",
            items: {
                type: "string",
            },
        },
        newLines: {
            type: "array",
            items: {
                type: "string",
            },
        },
        fetchedAt: {
            type: "number",
            minimum: 0,
        },
        expiresAt: {
            type: "number",
            minimum: 0,
        },
    },
    required: ["id", "prKey", "path", "oldLines", "newLines", "fetchedAt", "expiresAt"],
    additionalProperties: false,
} as const;

const PULL_REQUEST_FILE_HISTORY_RX_SCHEMA = {
    title: "pullrequestdotreview pull request file histories",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
            maxLength: 1500,
        },
        prKey: {
            type: "string",
            maxLength: 800,
        },
        path: {
            type: "string",
            maxLength: 1000,
        },
        entries: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
        fetchedAt: {
            type: "number",
            minimum: 0,
        },
        expiresAt: {
            type: "number",
            minimum: 0,
        },
    },
    required: ["id", "prKey", "path", "entries", "fetchedAt", "expiresAt"],
    additionalProperties: false,
} as const;

const PULL_REQUEST_COMMIT_RANGE_DIFF_RX_SCHEMA = {
    title: "pullrequestdotreview pull request commit range diffs",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
            maxLength: 1400,
        },
        prKey: {
            type: "string",
            maxLength: 800,
        },
        prRef: {
            type: "object",
            additionalProperties: true,
        },
        baseCommitHash: {
            type: "string",
            maxLength: 80,
        },
        headCommitHash: {
            type: "string",
            maxLength: 80,
        },
        selectedCommitHashes: {
            type: "array",
            items: {
                type: "string",
            },
        },
        diff: {
            type: "string",
        },
        diffstat: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
        fetchedAt: {
            type: "number",
            minimum: 0,
        },
        expiresAt: {
            type: "number",
            minimum: 0,
        },
    },
    required: ["id", "prKey", "prRef", "baseCommitHash", "headCommitHash", "selectedCommitHashes", "diff", "diffstat", "fetchedAt", "expiresAt"],
    additionalProperties: false,
} as const;

let hostDataReadyPromise: Promise<void> | null = null;
let hostDataDatabase: { close: () => Promise<boolean> } | null = null;
let hostDataFallbackActive = false;
let hostDataFallbackPromise: Promise<void> | null = null;

let repositoryCollection: Collection<RepositoryRecord, string> | null = null;
let repoPullRequestCollection: Collection<PersistedRepoPullRequestRecord, string> | null = null;
let pullRequestBundleCollection: Collection<PersistedPullRequestBundleRecord, string> | null = null;
let pullRequestFileContextCollection: Collection<PullRequestFileContextRecord, string> | null = null;
let pullRequestFileHistoryCollection: Collection<PullRequestFileHistoryRecord, string> | null = null;
let pullRequestCommitRangeDiffCollection: Collection<PullRequestCommitRangeDiffRecord, string> | null = null;

const repositoryScopedCollections = new Map<GitHost, ScopedCollection<RepositoryRecord>>();
const repoPullRequestScopedCollections = new LruCache<string, ScopedCollection<PersistedRepoPullRequestRecord>>(SCOPED_COLLECTION_CACHE_SIZE);
const pullRequestBundleScopedCollections = new LruCache<string, ScopedCollection<PersistedPullRequestBundleRecord>>(SCOPED_COLLECTION_CACHE_SIZE);
const pullRequestFileHistoryScopedCollections = new LruCache<string, ScopedCollection<PullRequestFileHistoryRecord>>(SCOPED_COLLECTION_CACHE_SIZE);
const pullRequestCommitRangeDiffScopedCollections = new LruCache<string, ScopedCollection<PullRequestCommitRangeDiffRecord>>(SCOPED_COLLECTION_CACHE_SIZE);
const fetchActivityListeners = new Set<() => void>();
const activeFetchesByScope = new Map<string, FetchActivity>();
const refetchRegistry = new LruCache<string, RefetchRegistryEntry>(SCOPED_COLLECTION_CACHE_SIZE);
const hostDataCollectionsVersionListeners = new Set<() => void>();
let fetchActivityVersion = 0;
let cachedFetchActivitySnapshotVersion = -1;
let cachedFetchActivitySnapshot: GitHostFetchActivitySnapshot = {
    activeFetches: [],
    activeFetchCount: 0,
    trackedScopeCount: 0,
};
let hostDataCollectionsVersion = 0;
let lastHostDataSweepAt: number | null = null;

function notifyFetchActivityListeners() {
    fetchActivityVersion += 1;
    for (const listener of fetchActivityListeners) {
        listener();
    }
}

function setFetchActivity(scopeId: string, label: string, fetching: boolean) {
    if (fetching) {
        const existing = activeFetchesByScope.get(scopeId);
        activeFetchesByScope.set(scopeId, {
            scopeId,
            label,
            startedAt: existing?.startedAt ?? Date.now(),
        });
    } else {
        activeFetchesByScope.delete(scopeId);
    }
    notifyFetchActivityListeners();
}

function notifyHostDataCollectionsVersionListeners() {
    hostDataCollectionsVersion += 1;
    for (const listener of hostDataCollectionsVersionListeners) {
        listener();
    }
}

function registerRefetchScope(scopeId: string, label: string, refetch: (opts?: { throwOnError?: boolean }) => Promise<void>) {
    const existing = refetchRegistry.get(scopeId);
    if (existing?.label === label && existing.refetch === refetch) {
        return;
    }
    const { evicted } = refetchRegistry.set(scopeId, {
        label,
        refetch,
    });
    if (evicted) {
        activeFetchesByScope.delete(evicted.key);
        notifyFetchActivityListeners();
    }
    // Do not notify during render-time scope registration; listeners update on fetch transitions.
}

function unregisterScope(scopeId: string) {
    const hadFetch = activeFetchesByScope.has(scopeId);
    refetchRegistry.delete(scopeId);
    activeFetchesByScope.delete(scopeId);
    if (hadFetch) {
        notifyFetchActivityListeners();
    }
}

export function subscribeGitHostFetchActivity(listener: () => void) {
    fetchActivityListeners.add(listener);
    return () => {
        fetchActivityListeners.delete(listener);
    };
}

export function getGitHostFetchActivitySnapshot(): GitHostFetchActivitySnapshot {
    if (cachedFetchActivitySnapshotVersion !== fetchActivityVersion) {
        const activeFetches = Array.from(activeFetchesByScope.values()).sort((a, b) => a.startedAt - b.startedAt);
        cachedFetchActivitySnapshot = {
            activeFetches,
            activeFetchCount: activeFetches.length,
            trackedScopeCount: refetchRegistry.size,
        };
        cachedFetchActivitySnapshotVersion = fetchActivityVersion;
    }
    return cachedFetchActivitySnapshot;
}

export function getHostDataCollectionsVersionSnapshot() {
    return hostDataCollectionsVersion;
}

export function subscribeHostDataCollectionsVersion(listener: () => void) {
    hostDataCollectionsVersionListeners.add(listener);
    return () => {
        hostDataCollectionsVersionListeners.delete(listener);
    };
}

function createCollectionUtils(refetch: (opts?: { throwOnError?: boolean }) => Promise<void>): CollectionUtils {
    let lastError: unknown;
    let isFetching = false;
    let dataUpdatedAt = 0;

    return {
        get lastError() {
            return lastError;
        },
        set lastError(value: unknown) {
            lastError = value;
        },
        get isFetching() {
            return isFetching;
        },
        set isFetching(value: boolean) {
            isFetching = value;
        },
        get dataUpdatedAt() {
            return dataUpdatedAt;
        },
        set dataUpdatedAt(value: number) {
            dataUpdatedAt = value;
        },
        refetch,
    };
}

function pullRequestBundleId(prRef: PullRequestRef) {
    return `${prRef.host}:${prRef.workspace}/${prRef.repo}/${prRef.pullRequestId}`;
}

export function pullRequestDetailsFetchScopeId(prRef: PullRequestRef) {
    return `pr-bundle:${pullRequestBundleId(prRef)}`;
}

function pullRequestFileContextId(prRef: PullRequestRef, path: string) {
    return `${pullRequestBundleId(prRef)}:${path}`;
}

function pullRequestFileHistoryId(prRef: PullRequestRef, path: string) {
    return `${pullRequestBundleId(prRef)}:history:${path}`;
}

function pullRequestCommitRangeDiffId(prRef: PullRequestRef, baseCommitHash: string, headCommitHash: string) {
    return `${pullRequestBundleId(prRef)}:range:${baseCommitHash}..${headCommitHash}`;
}

function pullRequestFileHistoryFetchScopeId(prRef: PullRequestRef, path: string) {
    return `pr-file-history:${pullRequestBundleId(prRef)}:${path}`;
}

function pullRequestCommitRangeDiffFetchScopeId(prRef: PullRequestRef, baseCommitHash: string, headCommitHash: string) {
    return `pr-range-diff:${pullRequestBundleId(prRef)}:${baseCommitHash}..${headCommitHash}`;
}

function normalizeRepoRef(repo: RepoRef): RepoRef {
    const workspace = repo.workspace.trim();
    const repositorySlug = repo.repo.trim();
    const fullName = typeof repo.fullName === "string" && repo.fullName.trim().length > 0 ? repo.fullName.trim() : `${workspace}/${repositorySlug}`;
    const displayName = typeof repo.displayName === "string" && repo.displayName.trim().length > 0 ? repo.displayName.trim() : repositorySlug;

    return {
        host: repo.host,
        workspace,
        repo: repositorySlug,
        fullName,
        displayName,
    };
}

function normalizeReposByHost(reposByHost: ReposByHost): ReposByHost {
    return {
        bitbucket: [...(reposByHost.bitbucket ?? [])].map(normalizeRepoRef).sort((a, b) => a.fullName.localeCompare(b.fullName)),
        github: [...(reposByHost.github ?? [])].map(normalizeRepoRef).sort((a, b) => a.fullName.localeCompare(b.fullName)),
    };
}

function stringifyCollectionRepos(reposByHost: ReposByHost) {
    const normalized = normalizeReposByHost(reposByHost);
    return JSON.stringify({
        bitbucket: normalized.bitbucket.map((repo) => ({
            workspace: repo.workspace,
            repo: repo.repo,
            fullName: repo.fullName,
        })),
        github: normalized.github.map((repo) => ({
            workspace: repo.workspace,
            repo: repo.repo,
            fullName: repo.fullName,
        })),
    });
}

function cacheExpiresAt(from: number) {
    return from + HOST_DATA_CACHE_TTL_MS;
}

function isExpiredRecord(record: { expiresAt?: number }, now: number) {
    if (typeof record.expiresAt !== "number") return false;
    return record.expiresAt <= now;
}

function approxRecordBytes(record: object) {
    return new TextEncoder().encode(JSON.stringify(record)).length;
}

function serializePullRequestCriticalBundle(
    critical: PullRequestCriticalBundle,
    existing: PersistedPullRequestBundleRecord | undefined,
): PersistedPullRequestBundleRecord {
    const fetchedAt = Date.now();
    return {
        id: pullRequestBundleId(critical.prRef),
        prRef: critical.prRef,
        pr: {
            ...(existing?.pr ?? {}),
            ...critical.pr,
        },
        diff: critical.diff,
        diffstat: critical.diffstat,
        commits: critical.commits,
        comments: existing?.comments ?? [],
        history: existing?.history ?? [],
        reviewers: existing?.reviewers ?? [],
        buildStatuses: existing?.buildStatuses ?? [],
        fetchedAt,
        expiresAt: cacheExpiresAt(fetchedAt),
        criticalFetchedAt: fetchedAt,
        deferredFetchedAt: existing?.deferredFetchedAt,
        deferredStatus: "loading",
    };
}

function mergePullRequestDeferredBundle(record: PersistedPullRequestBundleRecord, deferred: PullRequestDeferredBundle): PersistedPullRequestBundleRecord {
    const fetchedAt = Date.now();
    return {
        ...record,
        pr: deferred.prPatch ? { ...record.pr, ...deferred.prPatch } : record.pr,
        comments: deferred.comments,
        history: deferred.history ?? [],
        reviewers: deferred.reviewers ?? [],
        buildStatuses: deferred.buildStatuses ?? [],
        fetchedAt,
        expiresAt: cacheExpiresAt(fetchedAt),
        criticalFetchedAt: record.criticalFetchedAt ?? fetchedAt,
        deferredFetchedAt: fetchedAt,
        deferredStatus: "ready",
    };
}

function markPullRequestDeferredError(record: PersistedPullRequestBundleRecord): PersistedPullRequestBundleRecord {
    const now = Date.now();
    return {
        ...record,
        fetchedAt: now,
        expiresAt: cacheExpiresAt(now),
        deferredFetchedAt: now,
        deferredStatus: "error",
    };
}

function serializeRepoPullRequestRecord(repo: RepoRef, pullRequest: PullRequestSummary): PersistedRepoPullRequestRecord {
    const normalizedRepo = normalizeRepoRef(repo);
    const normalizedPullRequest = normalizePullRequestSummary(pullRequest);
    const repoKey = `${normalizedRepo.host}:${normalizedRepo.fullName}`;

    const fetchedAt = Date.now();
    return {
        id: `${repoKey}#${normalizedPullRequest.id}`,
        repoKey,
        host: normalizedRepo.host,
        repo: normalizedRepo,
        pullRequest: normalizedPullRequest,
        fetchedAt,
        expiresAt: cacheExpiresAt(fetchedAt),
    };
}

function serializePullRequestFileContextRecord({
    prRef,
    path,
    oldLines,
    newLines,
    fetchedAt,
}: {
    prRef: PullRequestRef;
    path: string;
    oldLines: string[];
    newLines: string[];
    fetchedAt: number;
}): PullRequestFileContextRecord {
    return {
        id: pullRequestFileContextId(prRef, path),
        prKey: pullRequestBundleId(prRef),
        path,
        oldLines,
        newLines,
        fetchedAt,
        expiresAt: cacheExpiresAt(fetchedAt),
    };
}

function serializePullRequestFileHistoryRecord({
    prRef,
    path,
    entries,
    fetchedAt,
}: {
    prRef: PullRequestRef;
    path: string;
    entries: PullRequestFileHistoryEntry[];
    fetchedAt: number;
}): PullRequestFileHistoryRecord {
    return {
        id: pullRequestFileHistoryId(prRef, path),
        prKey: pullRequestBundleId(prRef),
        path,
        entries,
        fetchedAt,
        expiresAt: cacheExpiresAt(fetchedAt),
    };
}

function serializePullRequestCommitRangeDiffRecord(diff: PullRequestCommitRangeDiff): PullRequestCommitRangeDiffRecord {
    const fetchedAt = Date.now();
    return {
        ...diff,
        id: pullRequestCommitRangeDiffId(diff.prRef, diff.baseCommitHash, diff.headCommitHash),
        prKey: pullRequestBundleId(diff.prRef),
        fetchedAt,
        expiresAt: cacheExpiresAt(fetchedAt),
    };
}

function isValidRepoRef(repo: RepoRef | undefined): repo is RepoRef {
    return Boolean(
        repo &&
            (repo.host === "bitbucket" || repo.host === "github") &&
            typeof repo.workspace === "string" &&
            repo.workspace.length > 0 &&
            typeof repo.repo === "string" &&
            repo.repo.length > 0,
    );
}

function isValidPullRequestSummary(pullRequest: PullRequestSummary | undefined): pullRequest is PullRequestSummary {
    return Boolean(pullRequest && typeof pullRequest.id === "number" && Number.isFinite(pullRequest.id) && typeof pullRequest.title === "string");
}

function normalizePullRequestSummary(pullRequest: PullRequestSummary): PullRequestSummary {
    const title = typeof pullRequest.title === "string" && pullRequest.title.trim().length > 0 ? pullRequest.title.trim() : `#${pullRequest.id}`;
    const state = typeof pullRequest.state === "string" && pullRequest.state.trim().length > 0 ? pullRequest.state : "OPEN";

    return {
        ...pullRequest,
        title,
        state,
    };
}

function getHostDataCollection<K extends HostDataCollectionKey>(key: K): HostDataCollectionForKey<K> {
    if (
        !repositoryCollection ||
        !repoPullRequestCollection ||
        !pullRequestBundleCollection ||
        !pullRequestFileContextCollection ||
        !pullRequestFileHistoryCollection ||
        !pullRequestCommitRangeDiffCollection
    ) {
        ensureCollectionsInitialized();
    }

    switch (key) {
        case "repositories":
            if (!repositoryCollection) {
                throw new Error("Repository collection is unavailable");
            }
            return repositoryCollection as HostDataCollectionForKey<K>;
        case "repoPullRequests":
            if (!repoPullRequestCollection) {
                throw new Error("Repository pull request collection is unavailable");
            }
            return repoPullRequestCollection as HostDataCollectionForKey<K>;
        case "pullRequestBundles":
            if (!pullRequestBundleCollection) {
                throw new Error("Pull request bundle collection is unavailable");
            }
            return pullRequestBundleCollection as HostDataCollectionForKey<K>;
        case "pullRequestFileContexts":
            if (!pullRequestFileContextCollection) {
                throw new Error("Pull request file context collection is unavailable");
            }
            return pullRequestFileContextCollection as HostDataCollectionForKey<K>;
        case "pullRequestFileHistories":
            if (!pullRequestFileHistoryCollection) {
                throw new Error("Pull request file history collection is unavailable");
            }
            return pullRequestFileHistoryCollection as HostDataCollectionForKey<K>;
        case "pullRequestCommitRangeDiffs":
            if (!pullRequestCommitRangeDiffCollection) {
                throw new Error("Pull request commit range diff collection is unavailable");
            }
            return pullRequestCommitRangeDiffCollection as HostDataCollectionForKey<K>;
        default: {
            const exhaustiveCheck: never = key;
            throw new Error(`Unsupported host data collection key: ${exhaustiveCheck}`);
        }
    }
}

function captureCollectionSnapshot<T extends { id: string }>(collection: Collection<T, string> | null) {
    if (!collection) return [];
    return Array.from(collection.values());
}

function hydrateCollectionRecords<T extends { id: string }>(collection: Collection<T, string> | null, records: T[]) {
    if (!collection || records.length === 0) return;
    for (const record of records) {
        const transaction = collection.insert(record);
        transaction.isPersisted.promise.catch(() => undefined);
    }
}

async function fallbackToInMemoryHostDataCollections() {
    if (hostDataFallbackActive) return;
    if (hostDataFallbackPromise) {
        await hostDataFallbackPromise;
        return;
    }

    hostDataFallbackPromise = (async () => {
        const repositoryRecords = captureCollectionSnapshot(repositoryCollection);
        const repoPullRequestRecords = captureCollectionSnapshot(repoPullRequestCollection);
        const pullRequestBundleRecords = captureCollectionSnapshot(pullRequestBundleCollection);
        const pullRequestFileContextRecords = captureCollectionSnapshot(pullRequestFileContextCollection);
        const pullRequestFileHistoryRecords = captureCollectionSnapshot(pullRequestFileHistoryCollection);
        const pullRequestCommitRangeDiffRecords = captureCollectionSnapshot(pullRequestCommitRangeDiffCollection);

        if (hostDataDatabase) {
            try {
                await hostDataDatabase.close();
            } catch (error) {
                console.warn("Failed to close host-data database during fallback.", error);
            }
        }

        hostDataDatabase = null;
        hostDataReadyPromise = Promise.resolve();

        repositoryCollection = null;
        repoPullRequestCollection = null;
        pullRequestBundleCollection = null;
        pullRequestFileContextCollection = null;
        pullRequestFileHistoryCollection = null;
        pullRequestCommitRangeDiffCollection = null;

        ensureCollectionsInitialized();

        hydrateCollectionRecords(repositoryCollection, repositoryRecords);
        hydrateCollectionRecords(repoPullRequestCollection, repoPullRequestRecords);
        hydrateCollectionRecords(pullRequestBundleCollection, pullRequestBundleRecords);
        hydrateCollectionRecords(pullRequestFileContextCollection, pullRequestFileContextRecords);
        hydrateCollectionRecords(pullRequestFileHistoryCollection, pullRequestFileHistoryRecords);
        hydrateCollectionRecords(pullRequestCommitRangeDiffCollection, pullRequestCommitRangeDiffRecords);

        const nextRepositoryCollection = getHostDataCollection("repositories");
        const nextRepoPullRequestCollection = getHostDataCollection("repoPullRequests");
        const nextPullRequestBundleCollection = getHostDataCollection("pullRequestBundles");
        const nextPullRequestFileHistoryCollection = getHostDataCollection("pullRequestFileHistories");
        const nextPullRequestCommitRangeDiffCollection = getHostDataCollection("pullRequestCommitRangeDiffs");

        repositoryScopedCollections.forEach((scoped) => {
            scoped.collection = nextRepositoryCollection;
        });
        for (const scoped of repoPullRequestScopedCollections.values()) {
            scoped.collection = nextRepoPullRequestCollection;
        }
        for (const scoped of pullRequestBundleScopedCollections.values()) {
            scoped.collection = nextPullRequestBundleCollection;
        }
        for (const scoped of pullRequestFileHistoryScopedCollections.values()) {
            scoped.collection = nextPullRequestFileHistoryCollection;
        }
        for (const scoped of pullRequestCommitRangeDiffScopedCollections.values()) {
            scoped.collection = nextPullRequestCommitRangeDiffCollection;
        }

        console.warn("Host-data collections switched to in-memory mode after storage quota errors.");
        hostDataFallbackActive = true;
        notifyHostDataCollectionsVersionListeners();
    })().finally(() => {
        hostDataFallbackPromise = null;
    });

    await hostDataFallbackPromise;
}

function isQuotaExceededError(error: unknown) {
    if (!error) return false;
    if (typeof DOMException !== "undefined" && error instanceof DOMException) {
        return error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014;
    }
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return message.includes("quota") && message.includes("exceeded");
    }
    return false;
}

function isRxErrorCode(error: unknown, code: string) {
    if (!error || typeof error !== "object") return false;
    const value = error as { code?: string; message?: string };
    if (value.code === code) return true;
    return typeof value.message === "string" && value.message.includes(code);
}

function logQuotaExceededWarning(context: string, error: unknown) {
    console.warn(`Host data persistence quota exceeded during ${context}; continuing without storing this payload.`, error);
}

async function persistCollectionTransaction(persistPromise: Promise<unknown>, context: string) {
    try {
        await persistPromise;
        return true;
    } catch (error) {
        if (isQuotaExceededError(error)) {
            logQuotaExceededWarning(context, error);
            return false;
        }
        throw error;
    }
}

function ensureCollectionsInitialized() {
    if (
        repositoryCollection &&
        repoPullRequestCollection &&
        pullRequestBundleCollection &&
        pullRequestFileContextCollection &&
        pullRequestFileHistoryCollection &&
        pullRequestCommitRangeDiffCollection
    ) {
        return;
    }

    repositoryCollection = createCollection(
        localOnlyCollectionOptions<RepositoryRecord, string>({
            id: REPOSITORY_TANSTACK_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    repoPullRequestCollection = createCollection(
        localOnlyCollectionOptions<PersistedRepoPullRequestRecord, string>({
            id: REPO_PULL_REQUEST_TANSTACK_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    pullRequestBundleCollection = createCollection(
        localOnlyCollectionOptions<PersistedPullRequestBundleRecord, string>({
            id: PULL_REQUEST_BUNDLE_TANSTACK_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    pullRequestFileContextCollection = createCollection(
        localOnlyCollectionOptions<PullRequestFileContextRecord, string>({
            id: PULL_REQUEST_FILE_CONTEXT_TANSTACK_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    pullRequestFileHistoryCollection = createCollection(
        localOnlyCollectionOptions<PullRequestFileHistoryRecord, string>({
            id: PULL_REQUEST_FILE_HISTORY_TANSTACK_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    pullRequestCommitRangeDiffCollection = createCollection(
        localOnlyCollectionOptions<PullRequestCommitRangeDiffRecord, string>({
            id: PULL_REQUEST_COMMIT_RANGE_DIFF_TANSTACK_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );
}

async function initRxdbCollections() {
    if (typeof window === "undefined") {
        ensureCollectionsInitialized();
        return;
    }

    const [{ createRxDatabase }, { getRxStorageDexie }] = await Promise.all([import("rxdb/plugins/core"), import("rxdb/plugins/storage-dexie")]);

    const database = await createRxDatabase({
        name: HOST_DATA_DATABASE_NAME,
        storage: getRxStorageDexie(),
        multiInstance: true,
        closeDuplicates: true,
    });

    hostDataDatabase = database;

    const collectionDefinitions = {
        [REPOSITORY_RX_COLLECTION_NAME]: {
            schema: REPOSITORY_RX_SCHEMA,
        },
        [REPO_PULL_REQUEST_RX_COLLECTION_NAME]: {
            schema: REPO_PULL_REQUEST_RX_SCHEMA,
        },
        [PULL_REQUEST_BUNDLE_RX_COLLECTION_NAME]: {
            schema: PULL_REQUEST_BUNDLE_RX_SCHEMA,
        },
        [PULL_REQUEST_FILE_CONTEXT_RX_COLLECTION_NAME]: {
            schema: PULL_REQUEST_FILE_CONTEXT_RX_SCHEMA,
        },
        [PULL_REQUEST_FILE_HISTORY_RX_COLLECTION_NAME]: {
            schema: PULL_REQUEST_FILE_HISTORY_RX_SCHEMA,
        },
        [PULL_REQUEST_COMMIT_RANGE_DIFF_RX_COLLECTION_NAME]: {
            schema: PULL_REQUEST_COMMIT_RANGE_DIFF_RX_SCHEMA,
        },
    } as const;

    for (const collectionName of REQUIRED_PERSISTED_COLLECTION_NAMES) {
        const collectionSchema = collectionDefinitions[collectionName];
        const existingCollections = database.collections as Record<string, (typeof database.collections)[string]>;
        if (existingCollections[collectionName]) continue;
        try {
            await database.addCollections({
                [collectionName]: collectionSchema,
            });
        } catch (error) {
            if (!isRxErrorCode(error, "COL23")) {
                throw error;
            }
            throw new Error(`Host-data required collection could not be opened due to RxDB collection limit: ${collectionName}`);
        }
    }

    for (const collectionName of OPTIONAL_PERSISTED_COLLECTION_NAMES) {
        const collectionSchema = collectionDefinitions[collectionName];
        const existingCollections = database.collections as Record<string, (typeof database.collections)[string]>;
        if (existingCollections[collectionName]) continue;
        try {
            await database.addCollections({
                [collectionName]: collectionSchema,
            });
        } catch (error) {
            if (!isRxErrorCode(error, "COL23")) {
                throw error;
            }
        }
    }

    const collections = database.collections as Record<string, (typeof database.collections)[string]>;
    const missingCollectionNames = REQUIRED_PERSISTED_COLLECTION_NAMES.filter((name) => !collections[name]);
    if (missingCollectionNames.length > 0) {
        throw new Error(`Host-data RxDB collections unavailable after init: ${missingCollectionNames.join(", ")}`);
    }

    repositoryCollection = createCollection(
        rxdbCollectionOptions<RepositoryRecord>({
            id: REPOSITORY_TANSTACK_COLLECTION_ID,
            rxCollection: collections[REPOSITORY_RX_COLLECTION_NAME],
            startSync: true,
        }),
    );

    repoPullRequestCollection = createCollection(
        rxdbCollectionOptions<PersistedRepoPullRequestRecord>({
            id: REPO_PULL_REQUEST_TANSTACK_COLLECTION_ID,
            rxCollection: collections[REPO_PULL_REQUEST_RX_COLLECTION_NAME],
            startSync: true,
        }),
    );

    pullRequestBundleCollection = createCollection(
        rxdbCollectionOptions<PersistedPullRequestBundleRecord>({
            id: PULL_REQUEST_BUNDLE_TANSTACK_COLLECTION_ID,
            rxCollection: collections[PULL_REQUEST_BUNDLE_RX_COLLECTION_NAME],
            startSync: true,
        }),
    );

    pullRequestFileContextCollection = collections[PULL_REQUEST_FILE_CONTEXT_RX_COLLECTION_NAME]
        ? createCollection(
              rxdbCollectionOptions<PullRequestFileContextRecord>({
                  id: PULL_REQUEST_FILE_CONTEXT_TANSTACK_COLLECTION_ID,
                  rxCollection: collections[PULL_REQUEST_FILE_CONTEXT_RX_COLLECTION_NAME],
                  startSync: true,
              }),
          )
        : createCollection(
              localOnlyCollectionOptions<PullRequestFileContextRecord, string>({
                  id: PULL_REQUEST_FILE_CONTEXT_TANSTACK_COLLECTION_ID,
                  getKey: (item) => item.id,
              }),
          );

    pullRequestFileHistoryCollection = collections[PULL_REQUEST_FILE_HISTORY_RX_COLLECTION_NAME]
        ? createCollection(
              rxdbCollectionOptions<PullRequestFileHistoryRecord>({
                  id: PULL_REQUEST_FILE_HISTORY_TANSTACK_COLLECTION_ID,
                  rxCollection: collections[PULL_REQUEST_FILE_HISTORY_RX_COLLECTION_NAME],
                  startSync: true,
              }),
          )
        : createCollection(
              localOnlyCollectionOptions<PullRequestFileHistoryRecord, string>({
                  id: PULL_REQUEST_FILE_HISTORY_TANSTACK_COLLECTION_ID,
                  getKey: (item) => item.id,
              }),
          );

    pullRequestCommitRangeDiffCollection = collections[PULL_REQUEST_COMMIT_RANGE_DIFF_RX_COLLECTION_NAME]
        ? createCollection(
              rxdbCollectionOptions<PullRequestCommitRangeDiffRecord>({
                  id: PULL_REQUEST_COMMIT_RANGE_DIFF_TANSTACK_COLLECTION_ID,
                  rxCollection: collections[PULL_REQUEST_COMMIT_RANGE_DIFF_RX_COLLECTION_NAME],
                  startSync: true,
              }),
          )
        : createCollection(
              localOnlyCollectionOptions<PullRequestCommitRangeDiffRecord, string>({
                  id: PULL_REQUEST_COMMIT_RANGE_DIFF_TANSTACK_COLLECTION_ID,
                  getKey: (item) => item.id,
              }),
          );

    await Promise.all([
        repositoryCollection.preload(),
        repoPullRequestCollection.preload(),
        pullRequestBundleCollection.preload(),
        pullRequestFileContextCollection.preload(),
        pullRequestFileHistoryCollection.preload(),
        pullRequestCommitRangeDiffCollection.preload(),
    ]);
}

export function ensureGitHostDataReady() {
    if (!hostDataReadyPromise) {
        hostDataReadyPromise = initRxdbCollections().catch((error) => {
            console.error("Failed to initialize RxDB host-data collections, falling back to in-memory collections.", error);
            ensureCollectionsInitialized();
        });
        hostDataReadyPromise = hostDataReadyPromise.then(async () => {
            await sweepExpiredGitHostData();
        });
    }
    return hostDataReadyPromise;
}

async function upsertRecord<K extends HostDataCollectionKey>(collectionKey: K, record: HostDataRecordForKey<K>): Promise<void> {
    if (
        collectionKey === "pullRequestBundles" ||
        collectionKey === "pullRequestFileContexts" ||
        collectionKey === "pullRequestFileHistories" ||
        collectionKey === "pullRequestCommitRangeDiffs"
    ) {
        const now = Date.now();
        if (!lastHostDataSweepAt || now - lastHostDataSweepAt > 60 * 1000) {
            await sweepExpiredGitHostData(now);
        }
    }
    const collection = getHostDataCollection(collectionKey);
    const existing = collection.get(record.id);
    if (!existing) {
        const transaction = collection.insert(record);
        const persisted = await persistCollectionTransaction(transaction.isPersisted.promise, `insert:${record.id}`);
        if (!persisted) {
            await fallbackToInMemoryHostDataCollections();
            await upsertRecord(collectionKey, record);
        }
        return;
    }

    const transaction = collection.update(record.id, (draft) => {
        Object.assign(draft as Record<string, unknown>, record);
    });
    const persisted = await persistCollectionTransaction(transaction.isPersisted.promise, `update:${record.id}`);
    if (!persisted) {
        await fallbackToInMemoryHostDataCollections();
        await upsertRecord(collectionKey, record);
    }
}

async function deleteRecord<K extends HostDataCollectionKey>(collectionKey: K, id: string): Promise<void> {
    const collection = getHostDataCollection(collectionKey);
    if (!collection.has(id)) return;
    const transaction = collection.delete(id);
    const persisted = await persistCollectionTransaction(transaction.isPersisted.promise, `delete:${id}`);
    if (!persisted) {
        await fallbackToInMemoryHostDataCollections();
        await deleteRecord(collectionKey, id);
    }
}

const HOST_DATA_COLLECTION_KEYS: HostDataCollectionKey[] = [
    "repositories",
    "repoPullRequests",
    "pullRequestBundles",
    "pullRequestFileContexts",
    "pullRequestFileHistories",
    "pullRequestCommitRangeDiffs",
];

async function sweepExpiredCollection<K extends HostDataCollectionKey>(collectionKey: K, now: number) {
    const collection = getHostDataCollection(collectionKey);
    let removed = 0;
    for (const record of collection.values()) {
        if (!isExpiredRecord(record as { expiresAt?: number }, now)) continue;
        await deleteRecord(collectionKey, record.id);
        removed += 1;
    }
    return removed;
}

export async function sweepExpiredGitHostData(now = Date.now()) {
    ensureCollectionsInitialized();
    let removed = 0;
    for (const collectionKey of HOST_DATA_COLLECTION_KEYS) {
        removed += await sweepExpiredCollection(collectionKey, now);
    }
    lastHostDataSweepAt = now;
    return { removed };
}

export async function clearGitHostCacheTierData() {
    ensureCollectionsInitialized();
    let removed = 0;
    for (const collectionKey of HOST_DATA_COLLECTION_KEYS) {
        const collection = getHostDataCollection(collectionKey);
        for (const record of collection.values()) {
            await deleteRecord(collectionKey, record.id);
            removed += 1;
        }
    }
    lastHostDataSweepAt = Date.now();
    return { removed };
}

export async function getGitHostDataDebugSnapshot(now = Date.now()): Promise<GitHostDataDebugSnapshot> {
    ensureCollectionsInitialized();
    const collections = {} as GitHostDataDebugSnapshot["collections"];
    let totalRecords = 0;
    let totalBytes = 0;

    for (const collectionKey of HOST_DATA_COLLECTION_KEYS) {
        const collection = getHostDataCollection(collectionKey);
        const summary: GitHostDataDebugSnapshot["collections"][HostDataCollectionKey] = {
            count: 0,
            approxBytes: 0,
            oldestFetchedAt: null,
            newestFetchedAt: null,
            oldestExpiresAt: null,
            newestExpiresAt: null,
            expiredCount: 0,
        };

        for (const record of collection.values()) {
            summary.count += 1;
            const bytes = approxRecordBytes(record);
            summary.approxBytes += bytes;
            totalBytes += bytes;

            const fetchedAt = (record as { fetchedAt?: number }).fetchedAt;
            if (typeof fetchedAt === "number") {
                summary.oldestFetchedAt = summary.oldestFetchedAt === null ? fetchedAt : Math.min(summary.oldestFetchedAt, fetchedAt);
                summary.newestFetchedAt = summary.newestFetchedAt === null ? fetchedAt : Math.max(summary.newestFetchedAt, fetchedAt);
            }

            const expiresAt = (record as { expiresAt?: number }).expiresAt;
            if (typeof expiresAt === "number") {
                summary.oldestExpiresAt = summary.oldestExpiresAt === null ? expiresAt : Math.min(summary.oldestExpiresAt, expiresAt);
                summary.newestExpiresAt = summary.newestExpiresAt === null ? expiresAt : Math.max(summary.newestExpiresAt, expiresAt);
                if (expiresAt <= now) {
                    summary.expiredCount += 1;
                }
            }
        }

        totalRecords += summary.count;
        collections[collectionKey] = summary;
    }

    return {
        backendMode: hostDataFallbackActive ? "memory" : "indexeddb",
        cacheTtlMs: HOST_DATA_CACHE_TTL_MS,
        totalRecords,
        totalBytes,
        lastSweepAt: lastHostDataSweepAt,
        collections,
    };
}

export function getPullRequestBundleCollection(prRef: PullRequestRef, options?: { staged?: boolean }) {
    ensureCollectionsInitialized();
    const bundleId = pullRequestBundleId(prRef);
    const staged = options?.staged ?? true;
    const scopeId = `${pullRequestDetailsFetchScopeId(prRef)}:${staged ? "v2" : "v1"}`;
    const scopeLabel = `Pull request details (${prRef.host}:${prRef.workspace}/${prRef.repo}#${prRef.pullRequestId}; ${staged ? "v2" : "v1"})`;
    const existing = pullRequestBundleScopedCollections.get(scopeId);
    if (existing) return existing;
    let requestSerial = 0;

    const utils = createCollectionUtils(async (opts) => {
        const requestId = ++requestSerial;
        utils.isFetching = true;
        setFetchActivity(scopeId, scopeLabel, true);
        try {
            if (!staged) {
                const bundle = await fetchPullRequestBundleByRef({ prRef });
                if (requestId !== requestSerial) return;
                const legacyRecord = {
                    ...bundle,
                    id: pullRequestBundleId(bundle.prRef),
                    fetchedAt: Date.now(),
                    expiresAt: cacheExpiresAt(Date.now()),
                    criticalFetchedAt: Date.now(),
                    deferredFetchedAt: Date.now(),
                    deferredStatus: "ready" as const,
                };
                await upsertRecord("pullRequestBundles", legacyRecord);
                utils.lastError = undefined;
                utils.dataUpdatedAt = Date.now();
            } else {
                const collection = getHostDataCollection("pullRequestBundles");
                const existingRecord = collection.get(bundleId);
                const critical = await fetchPullRequestCriticalByRef({ prRef });
                if (requestId !== requestSerial) return;
                const stagedCriticalRecord = serializePullRequestCriticalBundle(critical, existingRecord);
                await upsertRecord("pullRequestBundles", stagedCriticalRecord);
                utils.lastError = undefined;
                utils.dataUpdatedAt = Date.now();

                const deferredScopeId = `${scopeId}:deferred`;
                const deferredScopeLabel = `${scopeLabel} [deferred]`;
                setFetchActivity(deferredScopeId, deferredScopeLabel, true);
                try {
                    const deferred = await fetchPullRequestDeferredByRef({ prRef });
                    if (requestId !== requestSerial) return;
                    const currentRecord = collection.get(bundleId) ?? stagedCriticalRecord;
                    const mergedRecord = mergePullRequestDeferredBundle(currentRecord, deferred);
                    await upsertRecord("pullRequestBundles", mergedRecord);
                    utils.dataUpdatedAt = Date.now();
                } catch (deferredError) {
                    if (requestId !== requestSerial) return;
                    const currentRecord = collection.get(bundleId) ?? stagedCriticalRecord;
                    await upsertRecord("pullRequestBundles", markPullRequestDeferredError(currentRecord));
                    if (opts?.throwOnError && !existingRecord) {
                        throw deferredError;
                    }
                } finally {
                    setFetchActivity(deferredScopeId, deferredScopeLabel, false);
                }
            }
        } catch (error) {
            utils.lastError = error;
            if (opts?.throwOnError) {
                throw error;
            }
        } finally {
            utils.isFetching = false;
            setFetchActivity(scopeId, scopeLabel, false);
        }
    });

    const scoped: ScopedCollection<PersistedPullRequestBundleRecord> = {
        collection: getHostDataCollection("pullRequestBundles"),
        utils,
    };
    const { evicted } = pullRequestBundleScopedCollections.set(scopeId, scoped);
    if (evicted) {
        unregisterScope(evicted.key);
    }
    registerRefetchScope(scopeId, scopeLabel, utils.refetch);
    return scoped;
}

export function getPullRequestFileContextCollection() {
    return getHostDataCollection("pullRequestFileContexts");
}

export function getPullRequestCommitRangeDiffDataCollection() {
    return getHostDataCollection("pullRequestCommitRangeDiffs");
}

export function getPullRequestFileHistoryDataCollection() {
    return getHostDataCollection("pullRequestFileHistories");
}

export function getPullRequestCommitRangeDiffCollection({
    prRef,
    baseCommitHash,
    headCommitHash,
    selectedCommitHashes,
}: {
    prRef: PullRequestRef;
    baseCommitHash: string;
    headCommitHash: string;
    selectedCommitHashes: string[];
}) {
    ensureCollectionsInitialized();
    const normalizedBase = baseCommitHash.trim();
    const normalizedHead = headCommitHash.trim();
    const normalizedSelectedHashes = selectedCommitHashes.map((hash) => hash.trim()).filter(Boolean);
    if (!normalizedBase || !normalizedHead) {
        throw new Error("Base and head commit hashes are required to fetch commit range diff.");
    }
    const scopeId = pullRequestCommitRangeDiffFetchScopeId(prRef, normalizedBase, normalizedHead);
    const scopeLabel = `Pull request commit range diff (${prRef.host}:${prRef.workspace}/${prRef.repo}#${prRef.pullRequestId}:${normalizedBase}..${normalizedHead})`;
    const existing = pullRequestCommitRangeDiffScopedCollections.get(scopeId);
    if (existing) return existing;

    const utils = createCollectionUtils(async (opts) => {
        utils.isFetching = true;
        setFetchActivity(scopeId, scopeLabel, true);
        try {
            const rangeDiff = await fetchPullRequestCommitRangeDiff({
                prRef,
                baseCommitHash: normalizedBase,
                headCommitHash: normalizedHead,
                selectedCommitHashes: normalizedSelectedHashes,
            });
            await upsertRecord("pullRequestCommitRangeDiffs", serializePullRequestCommitRangeDiffRecord(rangeDiff));
            utils.lastError = undefined;
            utils.dataUpdatedAt = Date.now();
        } catch (error) {
            utils.lastError = error;
            if (opts?.throwOnError) {
                throw error;
            }
        } finally {
            utils.isFetching = false;
            setFetchActivity(scopeId, scopeLabel, false);
        }
    });

    const scoped: ScopedCollection<PullRequestCommitRangeDiffRecord> = {
        collection: getHostDataCollection("pullRequestCommitRangeDiffs"),
        utils,
    };
    const { evicted } = pullRequestCommitRangeDiffScopedCollections.set(scopeId, scoped);
    if (evicted) {
        unregisterScope(evicted.key);
    }
    registerRefetchScope(scopeId, scopeLabel, utils.refetch);
    return scoped;
}

export function getPullRequestFileHistoryCollection({
    prRef,
    path,
    commits,
    limit = 20,
}: {
    prRef: PullRequestRef;
    path: string;
    commits: Commit[];
    limit?: number;
}) {
    ensureCollectionsInitialized();
    const normalizedPath = path.trim();
    const revision = `${commits[0]?.hash ?? "none"}:${commits.length}`;
    const scopeId = `${pullRequestFileHistoryFetchScopeId(prRef, normalizedPath)}:${revision}:${limit}`;
    const scopeLabel = `Pull request file history (${prRef.host}:${prRef.workspace}/${prRef.repo}#${prRef.pullRequestId}:${normalizedPath})`;
    const existing = pullRequestFileHistoryScopedCollections.get(scopeId);
    if (existing) return existing;

    const utils = createCollectionUtils(async (opts) => {
        utils.isFetching = true;
        setFetchActivity(scopeId, scopeLabel, true);
        try {
            const history = await fetchPullRequestFileHistory({
                prRef,
                path: normalizedPath,
                commits: commits.map((commit) => ({ ...commit })),
                limit,
            });
            await upsertRecord(
                "pullRequestFileHistories",
                serializePullRequestFileHistoryRecord({
                    prRef,
                    path: normalizedPath,
                    entries: history.entries,
                    fetchedAt: history.fetchedAt,
                }),
            );
            utils.lastError = undefined;
            utils.dataUpdatedAt = Date.now();
        } catch (error) {
            utils.lastError = error;
            if (opts?.throwOnError) {
                throw error;
            }
        } finally {
            utils.isFetching = false;
            setFetchActivity(scopeId, scopeLabel, false);
        }
    });

    const scoped: ScopedCollection<PullRequestFileHistoryRecord> = {
        collection: getHostDataCollection("pullRequestFileHistories"),
        utils,
    };
    const { evicted } = pullRequestFileHistoryScopedCollections.set(scopeId, scoped);
    if (evicted) {
        unregisterScope(evicted.key);
    }
    registerRefetchScope(scopeId, scopeLabel, utils.refetch);
    return scoped;
}

export async function savePullRequestFileContextRecord({
    prRef,
    path,
    oldLines,
    newLines,
    fetchedAt,
}: {
    prRef: PullRequestRef;
    path: string;
    oldLines: string[];
    newLines: string[];
    fetchedAt?: number;
}) {
    const record = serializePullRequestFileContextRecord({
        prRef,
        path,
        oldLines,
        newLines,
        fetchedAt: fetchedAt ?? Date.now(),
    });
    await upsertRecord("pullRequestFileContexts", record);
}

export function getRepoPullRequestCollection(data: { hosts: GitHost[]; reposByHost: ReposByHost }) {
    ensureCollectionsInitialized();
    const normalizedHosts = [...data.hosts].sort();
    const normalizedReposByHost = normalizeReposByHost(data.reposByHost);
    const serializedRepos = stringifyCollectionRepos(normalizedReposByHost);
    const scopeId = `repo-prs:${normalizedHosts.join(",")}:${serializedRepos}`;
    const hostLabel = normalizedHosts.length > 0 ? normalizedHosts.join(", ") : "none";
    const selectedRepoCount = normalizedHosts.reduce((count, host) => count + (normalizedReposByHost[host]?.length ?? 0), 0);
    const scopeLabel = `Repository pull requests (${hostLabel}; ${selectedRepoCount} repos)`;
    const existing = repoPullRequestScopedCollections.get(scopeId);
    if (existing) return existing;

    const utils = createCollectionUtils(async (opts) => {
        const collection = getHostDataCollection("repoPullRequests");
        if (normalizedHosts.length === 0) {
            utils.lastError = undefined;
            return;
        }

        const selectedRepoKeys = new Set<string>();
        for (const host of normalizedHosts) {
            for (const repo of normalizedReposByHost[host] ?? []) {
                const normalizedRepo = normalizeRepoRef(repo);
                selectedRepoKeys.add(`${normalizedRepo.host}:${normalizedRepo.fullName}`);
            }
        }

        utils.isFetching = true;
        try {
            const settled = await Promise.allSettled(
                normalizedHosts.map(async (host) => {
                    const repos = normalizedReposByHost[host] ?? [];
                    if (repos.length === 0) {
                        return [] as Array<{
                            repo: RepoRef;
                            pullRequests: PullRequestSummary[];
                        }>;
                    }
                    const hostScopeId = `${scopeId}:host:${host}`;
                    const hostScopeLabel = `Repository pull requests (${host}; ${repos.length} repos)`;
                    setFetchActivity(hostScopeId, hostScopeLabel, true);
                    try {
                        return await fetchRepoPullRequestsForHost({ host, repos });
                    } finally {
                        setFetchActivity(hostScopeId, hostScopeLabel, false);
                    }
                }),
            );

            const response = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
            if (response.length === 0) {
                const firstFailure = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
                if (firstFailure) {
                    throw firstFailure.reason;
                }
            }

            const nextRecords = response.flatMap(({ repo, pullRequests }) => {
                if (!isValidRepoRef(repo)) return [] as PersistedRepoPullRequestRecord[];
                return pullRequests
                    .filter((pullRequest) => isValidPullRequestSummary(pullRequest))
                    .map((pullRequest) => serializeRepoPullRequestRecord(repo, normalizePullRequestSummary(pullRequest)));
            });

            const nextIds = new Set(nextRecords.map((record) => record.id));

            for (const record of nextRecords) {
                await upsertRecord("repoPullRequests", record);
            }

            for (const existingRecord of collection.values()) {
                if (!selectedRepoKeys.has(existingRecord.repoKey)) continue;
                if (nextIds.has(existingRecord.id)) continue;
                await deleteRecord("repoPullRequests", existingRecord.id);
            }

            utils.lastError = undefined;
            utils.dataUpdatedAt = Date.now();
        } catch (error) {
            utils.lastError = error;
            if (opts?.throwOnError) {
                throw error;
            }
        } finally {
            utils.isFetching = false;
        }
    });

    const scoped: ScopedCollection<PersistedRepoPullRequestRecord> = {
        collection: getHostDataCollection("repoPullRequests"),
        utils,
    };
    const { evicted } = repoPullRequestScopedCollections.set(scopeId, scoped);
    if (evicted) {
        unregisterScope(evicted.key);
    }
    registerRefetchScope(scopeId, scopeLabel, utils.refetch);
    return scoped;
}

export function getRepositoryCollection(host: GitHost) {
    ensureCollectionsInitialized();
    const existing = repositoryScopedCollections.get(host);
    if (existing) return existing;
    const scopeId = `repos:${host}`;
    const scopeLabel = `Repositories (${host})`;

    const utils = createCollectionUtils(async (opts) => {
        const collection = getHostDataCollection("repositories");
        utils.isFetching = true;
        setFetchActivity(scopeId, scopeLabel, true);
        try {
            const repositories = await listRepositoriesForHost({ host });
            const timestamp = Date.now();
            const nextRecords = repositories.map(normalizeRepoRef).map((repository) => ({
                ...repository,
                id: `${repository.host}:${repository.fullName}`,
                fetchedAt: timestamp,
                expiresAt: cacheExpiresAt(timestamp),
            }));
            const nextIds = new Set(nextRecords.map((record) => record.id));

            for (const record of nextRecords) {
                await upsertRecord("repositories", record);
            }

            for (const existingRecord of collection.values()) {
                if (existingRecord.host !== host) continue;
                if (nextIds.has(existingRecord.id)) continue;
                await deleteRecord("repositories", existingRecord.id);
            }

            utils.lastError = undefined;
            utils.dataUpdatedAt = Date.now();
        } catch (error) {
            utils.lastError = error;
            if (opts?.throwOnError) {
                throw error;
            }
        } finally {
            utils.isFetching = false;
            setFetchActivity(scopeId, scopeLabel, false);
        }
    });

    const scoped: ScopedCollection<RepositoryRecord> = {
        collection: getHostDataCollection("repositories"),
        utils,
    };
    repositoryScopedCollections.set(host, scoped);
    registerRefetchScope(scopeId, scopeLabel, utils.refetch);
    return scoped;
}
