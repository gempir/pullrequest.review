import { type Collection, createCollection, localOnlyCollectionOptions } from "@tanstack/db";
import { rxdbCollectionOptions } from "@tanstack/rxdb-db-collection";
import { fetchPullRequestBundleByRef, fetchRepoPullRequestsForHost, listRepositoriesForHost } from "@/lib/git-host/service";
import type { GitHost, PullRequestBundle, PullRequestRef, PullRequestSummary, RepoRef } from "@/lib/git-host/types";
import { LruCache } from "@/lib/utils/lru";

export type PullRequestBundleRecord = PullRequestBundle & {
    id: string;
    fetchedAt: number;
};

type PersistedPullRequestBundleRecord = PullRequestBundleRecord;

export type PullRequestFileContextRecord = {
    id: string;
    prKey: string;
    path: string;
    oldLines: string[];
    newLines: string[];
    fetchedAt: number;
};

type PersistedRepoPullRequestRecord = {
    id: string;
    repoKey: string;
    host: GitHost;
    repo: RepoRef;
    pullRequest: PullRequestSummary;
    fetchedAt: number;
};

export type RepositoryRecord = RepoRef & {
    id: string;
    fetchedAt: number;
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

type HostDataCollectionKey = "repositories" | "repoPullRequests" | "pullRequestBundles" | "pullRequestFileContexts";
type HostDataRecordMap = {
    repositories: RepositoryRecord;
    repoPullRequests: PersistedRepoPullRequestRecord;
    pullRequestBundles: PersistedPullRequestBundleRecord;
    pullRequestFileContexts: PullRequestFileContextRecord;
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

export type GitHostFetchActivitySnapshot = {
    activeFetches: FetchActivity[];
    activeFetchCount: number;
    trackedScopeCount: number;
};

const HOST_DATA_DATABASE_NAME = "pullrequestdotreview_host_data_v3";
const REPOSITORY_RX_COLLECTION_NAME = "repositories";
const REPO_PULL_REQUEST_RX_COLLECTION_NAME = "repo_pull_requests";
const PULL_REQUEST_BUNDLE_RX_COLLECTION_NAME = "pull_request_bundles";
const PULL_REQUEST_FILE_CONTEXT_RX_COLLECTION_NAME = "pull_request_file_contexts";

const REPOSITORY_TANSTACK_COLLECTION_ID = "repos:rxdb";
const REPO_PULL_REQUEST_TANSTACK_COLLECTION_ID = "repo-prs:rxdb";
const PULL_REQUEST_BUNDLE_TANSTACK_COLLECTION_ID = "pr-bundle:rxdb";
const PULL_REQUEST_FILE_CONTEXT_TANSTACK_COLLECTION_ID = "pr-file-contexts:rxdb";
const SCOPED_COLLECTION_CACHE_SIZE = 100;

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
    },
    required: ["id", "host", "workspace", "repo", "fullName", "displayName", "fetchedAt"],
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
    },
    required: ["id", "repoKey", "host", "repo", "pullRequest", "fetchedAt"],
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
    },
    required: ["id", "prRef", "pr", "diff", "diffstat", "commits", "comments", "fetchedAt"],
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
    },
    required: ["id", "prKey", "path", "oldLines", "newLines", "fetchedAt"],
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

const repositoryScopedCollections = new Map<GitHost, ScopedCollection<RepositoryRecord>>();
const repoPullRequestScopedCollections = new LruCache<string, ScopedCollection<PersistedRepoPullRequestRecord>>(SCOPED_COLLECTION_CACHE_SIZE);
const pullRequestBundleScopedCollections = new LruCache<string, ScopedCollection<PersistedPullRequestBundleRecord>>(SCOPED_COLLECTION_CACHE_SIZE);
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

export async function refetchAllGitHostData(opts?: { throwOnError?: boolean }) {
    const refetchers = Array.from(refetchRegistry.values());
    if (refetchers.length === 0) return;

    const settled = await Promise.allSettled(refetchers.map((entry) => entry.refetch({ throwOnError: opts?.throwOnError ?? false })));
    if (!opts?.throwOnError) return;

    const firstFailure = settled.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (firstFailure) {
        throw firstFailure.reason;
    }
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

function serializePullRequestBundle(bundle: PullRequestBundle): PersistedPullRequestBundleRecord {
    return {
        ...bundle,
        id: pullRequestBundleId(bundle.prRef),
        fetchedAt: Date.now(),
    };
}

function serializeRepoPullRequestRecord(repo: RepoRef, pullRequest: PullRequestSummary): PersistedRepoPullRequestRecord {
    const normalizedRepo = normalizeRepoRef(repo);
    const normalizedPullRequest = normalizePullRequestSummary(pullRequest);
    const repoKey = `${normalizedRepo.host}:${normalizedRepo.fullName}`;

    return {
        id: `${repoKey}#${normalizedPullRequest.id}`,
        repoKey,
        host: normalizedRepo.host,
        repo: normalizedRepo,
        pullRequest: normalizedPullRequest,
        fetchedAt: Date.now(),
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
    if (!repositoryCollection || !repoPullRequestCollection || !pullRequestBundleCollection || !pullRequestFileContextCollection) {
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

        ensureCollectionsInitialized();

        hydrateCollectionRecords(repositoryCollection, repositoryRecords);
        hydrateCollectionRecords(repoPullRequestCollection, repoPullRequestRecords);
        hydrateCollectionRecords(pullRequestBundleCollection, pullRequestBundleRecords);
        hydrateCollectionRecords(pullRequestFileContextCollection, pullRequestFileContextRecords);

        const nextRepositoryCollection = getHostDataCollection("repositories");
        const nextRepoPullRequestCollection = getHostDataCollection("repoPullRequests");
        const nextPullRequestBundleCollection = getHostDataCollection("pullRequestBundles");

        repositoryScopedCollections.forEach((scoped) => {
            scoped.collection = nextRepositoryCollection;
        });
        for (const scoped of repoPullRequestScopedCollections.values()) {
            scoped.collection = nextRepoPullRequestCollection;
        }
        for (const scoped of pullRequestBundleScopedCollections.values()) {
            scoped.collection = nextPullRequestBundleCollection;
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
    if (repositoryCollection && repoPullRequestCollection && pullRequestBundleCollection && pullRequestFileContextCollection) {
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
    });

    hostDataDatabase = database;

    const collections = await database.addCollections({
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
    });

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

    pullRequestFileContextCollection = createCollection(
        rxdbCollectionOptions<PullRequestFileContextRecord>({
            id: PULL_REQUEST_FILE_CONTEXT_TANSTACK_COLLECTION_ID,
            rxCollection: collections[PULL_REQUEST_FILE_CONTEXT_RX_COLLECTION_NAME],
            startSync: true,
        }),
    );

    await Promise.all([
        repositoryCollection.preload(),
        repoPullRequestCollection.preload(),
        pullRequestBundleCollection.preload(),
        pullRequestFileContextCollection.preload(),
    ]);
}

export function ensureGitHostDataReady() {
    if (!hostDataReadyPromise) {
        hostDataReadyPromise = initRxdbCollections().catch((error) => {
            console.error("Failed to initialize RxDB host-data collections, falling back to in-memory collections.", error);
            ensureCollectionsInitialized();
        });
    }
    return hostDataReadyPromise;
}

async function upsertRecord<K extends HostDataCollectionKey>(collectionKey: K, record: HostDataRecordForKey<K>): Promise<void> {
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

export function getPullRequestBundleCollection(prRef: PullRequestRef) {
    ensureCollectionsInitialized();
    const bundleId = pullRequestBundleId(prRef);
    const scopeId = pullRequestDetailsFetchScopeId(prRef);
    const scopeLabel = `Pull request details (${prRef.host}:${prRef.workspace}/${prRef.repo}#${prRef.pullRequestId})`;
    const existing = pullRequestBundleScopedCollections.get(bundleId);
    if (existing) return existing;

    const utils = createCollectionUtils(async (opts) => {
        utils.isFetching = true;
        setFetchActivity(scopeId, scopeLabel, true);
        try {
            const bundle = await fetchPullRequestBundleByRef({ prRef });
            await upsertRecord("pullRequestBundles", serializePullRequestBundle(bundle));
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

    const scoped: ScopedCollection<PersistedPullRequestBundleRecord> = {
        collection: getHostDataCollection("pullRequestBundles"),
        utils,
    };
    const { evicted } = pullRequestBundleScopedCollections.set(bundleId, scoped);
    if (evicted) {
        unregisterScope(`pr-bundle:${evicted.key}`);
    }
    registerRefetchScope(scopeId, scopeLabel, utils.refetch);
    return scoped;
}

export function getPullRequestFileContextCollection() {
    return getHostDataCollection("pullRequestFileContexts");
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
