import { type Collection, createCollection, localOnlyCollectionOptions } from "@tanstack/db";
import { rxdbCollectionOptions } from "@tanstack/rxdb-db-collection";
import { fetchPullRequestBundleByRef, fetchRepoPullRequestsForHost, listRepositoriesForHost } from "@/lib/git-host/service";
import type { GitHost, PullRequestBundle, PullRequestRef, PullRequestSummary, RepoRef } from "@/lib/git-host/types";

export type PullRequestBundleRecord = PullRequestBundle & {
    id: string;
    fetchedAt: number;
};

type PersistedPullRequestBundleRecord = {
    id: string;
    bundleJson: string;
    fetchedAt: number;
};

type PersistedRepoPullRequestRecord = {
    id: string;
    repoKey: string;
    host: GitHost;
    repoJson: string;
    pullRequestJson: string;
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

const HOST_DATA_DATABASE_NAME = "pullrequestdotreview_host_data_v2";
const REPOSITORY_RX_COLLECTION_NAME = "repositories";
const REPO_PULL_REQUEST_RX_COLLECTION_NAME = "repo_pull_requests";
const PULL_REQUEST_BUNDLE_RX_COLLECTION_NAME = "pull_request_bundles";

const REPOSITORY_TANSTACK_COLLECTION_ID = "repos:rxdb";
const REPO_PULL_REQUEST_TANSTACK_COLLECTION_ID = "repo-prs:rxdb";
const PULL_REQUEST_BUNDLE_TANSTACK_COLLECTION_ID = "pr-bundle:rxdb";

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
        repoJson: {
            type: "string",
        },
        pullRequestJson: {
            type: "string",
        },
        fetchedAt: {
            type: "number",
            minimum: 0,
        },
    },
    required: ["id", "repoKey", "host", "repoJson", "pullRequestJson", "fetchedAt"],
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
        bundleJson: {
            type: "string",
        },
        fetchedAt: {
            type: "number",
            minimum: 0,
        },
    },
    required: ["id", "bundleJson", "fetchedAt"],
    additionalProperties: false,
} as const;

let hostDataReadyPromise: Promise<void> | null = null;
let hostDataDatabase: { close: () => Promise<boolean> } | null = null;

let repositoryCollection: Collection<RepositoryRecord, string> | null = null;
let repoPullRequestCollection: Collection<PersistedRepoPullRequestRecord, string> | null = null;
let pullRequestBundleCollection: Collection<PersistedPullRequestBundleRecord, string> | null = null;

const repositoryScopedCollections = new Map<GitHost, ScopedCollection<RepositoryRecord>>();
const repoPullRequestScopedCollections = new Map<string, ScopedCollection<PersistedRepoPullRequestRecord>>();
const pullRequestBundleScopedCollections = new Map<string, ScopedCollection<PersistedPullRequestBundleRecord>>();
const fetchActivityListeners = new Set<() => void>();
const activeFetchesByScope = new Map<string, FetchActivity>();
const refetchRegistry = new Map<string, RefetchRegistryEntry>();
let fetchActivityVersion = 0;
let cachedFetchActivitySnapshotVersion = -1;
let cachedFetchActivitySnapshot: GitHostFetchActivitySnapshot = {
    activeFetches: [],
    activeFetchCount: 0,
    trackedScopeCount: 0,
};

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

function registerRefetchScope(scopeId: string, label: string, refetch: (opts?: { throwOnError?: boolean }) => Promise<void>) {
    const existing = refetchRegistry.get(scopeId);
    if (existing?.label === label && existing.refetch === refetch) {
        return;
    }
    refetchRegistry.set(scopeId, {
        label,
        refetch,
    });
    // Do not notify during render-time scope registration; listeners update on fetch transitions.
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
    const serialized: PullRequestBundleRecord = {
        ...bundle,
        id: pullRequestBundleId(bundle.prRef),
        fetchedAt: Date.now(),
    };

    return {
        id: serialized.id,
        fetchedAt: serialized.fetchedAt,
        bundleJson: JSON.stringify(serialized),
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
        repoJson: JSON.stringify(normalizedRepo),
        pullRequestJson: JSON.stringify(normalizedPullRequest),
        fetchedAt: Date.now(),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isValidPullRequestRef(value: unknown): value is PullRequestRef {
    if (!isRecord(value)) return false;
    return (
        (value.host === "bitbucket" || value.host === "github") &&
        typeof value.workspace === "string" &&
        value.workspace.length > 0 &&
        typeof value.repo === "string" &&
        value.repo.length > 0 &&
        typeof value.pullRequestId === "string" &&
        value.pullRequestId.length > 0
    );
}

export function isValidPullRequestBundleRecord(value: unknown): value is PullRequestBundleRecord {
    if (!isRecord(value)) return false;
    const pullRequest = value.pr;
    if (!isRecord(pullRequest)) return false;
    return (
        typeof value.id === "string" &&
        value.id.length > 0 &&
        isValidPullRequestRef(value.prRef) &&
        typeof value.diff === "string" &&
        Array.isArray(value.diffstat) &&
        Array.isArray(value.commits) &&
        Array.isArray(value.comments) &&
        typeof pullRequest.id === "number" &&
        Number.isFinite(pullRequest.id) &&
        typeof pullRequest.title === "string" &&
        typeof pullRequest.state === "string"
    );
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

function ensureCollectionsInitialized() {
    if (repositoryCollection && repoPullRequestCollection && pullRequestBundleCollection) {
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
}

async function initRxdbCollections() {
    if (typeof window === "undefined") {
        ensureCollectionsInitialized();
        return;
    }

    const [{ createRxDatabase }, { getRxStorageLocalstorage }] = await Promise.all([import("rxdb/plugins/core"), import("rxdb/plugins/storage-localstorage")]);

    const database = await createRxDatabase({
        name: HOST_DATA_DATABASE_NAME,
        storage: getRxStorageLocalstorage(),
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

    await Promise.all([repositoryCollection.preload(), repoPullRequestCollection.preload(), pullRequestBundleCollection.preload()]);
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

async function upsertRecord<T extends { id: string }>(collection: Collection<T, string>, record: T) {
    const existing = collection.get(record.id);
    if (!existing) {
        const transaction = collection.insert(record);
        await transaction.isPersisted.promise;
        return;
    }

    const transaction = collection.update(record.id, (draft) => {
        Object.assign(draft as Record<string, unknown>, record);
    });
    await transaction.isPersisted.promise;
}

async function deleteRecord<T extends { id: string }>(collection: Collection<T, string>, id: string) {
    if (!collection.has(id)) return;
    const transaction = collection.delete(id);
    await transaction.isPersisted.promise;
}

export function getPullRequestBundleCollection(prRef: PullRequestRef) {
    if (!pullRequestBundleCollection) ensureCollectionsInitialized();
    const collection = pullRequestBundleCollection;
    if (!collection) {
        throw new Error("Pull request bundle collection is unavailable");
    }

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
            await upsertRecord(collection, serializePullRequestBundle(bundle));
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

    const scoped = { collection, utils };
    pullRequestBundleScopedCollections.set(bundleId, scoped);
    registerRefetchScope(scopeId, scopeLabel, utils.refetch);
    return scoped;
}

export function getRepoPullRequestCollection(data: { hosts: GitHost[]; reposByHost: ReposByHost }) {
    if (!repoPullRequestCollection) ensureCollectionsInitialized();
    const collection = repoPullRequestCollection;
    if (!collection) {
        throw new Error("Repository pull request collection is unavailable");
    }

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
                await upsertRecord(collection, record);
            }

            for (const existingRecord of collection.values()) {
                if (!selectedRepoKeys.has(existingRecord.repoKey)) continue;
                if (nextIds.has(existingRecord.id)) continue;
                await deleteRecord(collection, existingRecord.id);
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

    const scoped = { collection, utils };
    repoPullRequestScopedCollections.set(scopeId, scoped);
    registerRefetchScope(scopeId, scopeLabel, utils.refetch);
    return scoped;
}

export function getRepositoryCollection(host: GitHost) {
    if (!repositoryCollection) ensureCollectionsInitialized();
    const collection = repositoryCollection;
    if (!collection) {
        throw new Error("Repository collection is unavailable");
    }

    const existing = repositoryScopedCollections.get(host);
    if (existing) return existing;
    const scopeId = `repos:${host}`;
    const scopeLabel = `Repositories (${host})`;

    const utils = createCollectionUtils(async (opts) => {
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
                await upsertRecord(collection, record);
            }

            for (const existingRecord of collection.values()) {
                if (existingRecord.host !== host) continue;
                if (nextIds.has(existingRecord.id)) continue;
                await deleteRecord(collection, existingRecord.id);
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

    const scoped = { collection, utils };
    repositoryScopedCollections.set(host, scoped);
    registerRefetchScope(scopeId, scopeLabel, utils.refetch);
    return scoped;
}

export async function __resetGitHostCollectionsForTests() {
    if (hostDataDatabase) {
        await hostDataDatabase.close();
    }

    hostDataDatabase = null;
    hostDataReadyPromise = null;

    repositoryCollection = null;
    repoPullRequestCollection = null;
    pullRequestBundleCollection = null;

    repositoryScopedCollections.clear();
    repoPullRequestScopedCollections.clear();
    pullRequestBundleScopedCollections.clear();
    activeFetchesByScope.clear();
    refetchRegistry.clear();
    notifyFetchActivityListeners();
}
