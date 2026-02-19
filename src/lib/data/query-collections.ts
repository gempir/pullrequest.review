import { type Collection, createCollection, localOnlyCollectionOptions } from "@tanstack/db";
import { rxdbCollectionOptions } from "@tanstack/rxdb-db-collection";
import {
    clearGitHostCacheTierData,
    ensureGitHostDataReady,
    type GitHostDataDebugSnapshot,
    getGitHostDataDebugSnapshot,
    sweepExpiredGitHostData,
} from "@/lib/git-host/query-collections";
import type { GitHost, RepoRef } from "@/lib/git-host/types";

export type StorageTier = "cache" | "state" | "permanent";

const DATA_DATABASE_NAME = "pullrequestdotreview_data_v1";
const STATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REVIEW_DERIVED_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const REVIEW_DERIVED_CACHE_MAX_BYTES = 512 * 1024;
const REVIEW_DERIVED_CACHE_MAX_RECORDS = 120;
const LEGACY_RESET_METADATA_ID = "legacy_reset_v1";

const APP_PREFERENCES_COLLECTION_NAME = "app_preferences";
const REVIEW_VIEWED_STATE_COLLECTION_NAME = "review_viewed_state";
const REVIEW_DIRECTORY_STATE_COLLECTION_NAME = "review_directory_state";
const REVIEW_LAYOUT_STATE_COLLECTION_NAME = "review_layout_state";
const INLINE_COMMENT_DRAFTS_COLLECTION_NAME = "inline_comment_drafts";
const INLINE_COMMENT_ACTIVE_DRAFT_COLLECTION_NAME = "inline_comment_active_draft";
const APP_METADATA_COLLECTION_NAME = "app_metadata";

const APP_PREFERENCES_COLLECTION_ID = "app-preferences:rxdb";
const REVIEW_VIEWED_STATE_COLLECTION_ID = "review-viewed-state:rxdb";
const REVIEW_DIRECTORY_STATE_COLLECTION_ID = "review-directory-state:rxdb";
const REVIEW_LAYOUT_STATE_COLLECTION_ID = "review-layout-state:rxdb";
const INLINE_COMMENT_DRAFTS_COLLECTION_ID = "inline-comment-drafts:rxdb";
const INLINE_COMMENT_ACTIVE_DRAFT_COLLECTION_ID = "inline-comment-active-draft:rxdb";
const APP_METADATA_COLLECTION_ID = "app-metadata:rxdb";

const APPEARANCE_RECORD_ID = "appearance";
const DIFF_OPTIONS_RECORD_ID = "diff-options";
const TREE_SETTINGS_RECORD_ID = "tree-settings";
const SHORTCUTS_RECORD_ID = "shortcuts";
const HOST_PREFERENCES_RECORD_ID = "host-preferences";
const REVIEW_LAYOUT_RECORD_ID = "review-layout";
const REVIEW_PERF_V2_FLAG_RECORD_ID = "review-perf-v2";

const LOCAL_STORAGE_RESET_PREFIX = "pr_review_";

type BaseCollectionRecord = {
    id: string;
    updatedAt: number;
    expiresAt: number | null;
};

type AppPreferenceRecord = BaseCollectionRecord & {
    value: Record<string, unknown>;
};

type AppearanceSettingsRecord = BaseCollectionRecord & {
    id: typeof APPEARANCE_RECORD_ID;
    appThemeMode: "auto" | "light" | "dark";
    sansFontFamily: string;
    monospaceFontFamily: string;
    sansFontSize: number;
    sansLineHeight: number;
    monospaceFontSize: number;
    monospaceLineHeight: number;
    treeUseCustomTypography: boolean;
    treeFontFamily: string;
    treeFontSize: number;
    treeLineHeight: number;
};

type DiffOptionsRecord = BaseCollectionRecord & {
    id: typeof DIFF_OPTIONS_RECORD_ID;
    followSystemTheme: boolean;
    theme: string;
    diffUseCustomTypography: boolean;
    diffFontFamily: string;
    diffFontSize: number;
    diffLineHeight: number;
    diffStyle: "unified" | "split";
    diffIndicators: "classic" | "bars" | "none";
    disableBackground: boolean;
    hunkSeparators: "simple" | "metadata" | "line-info";
    expandUnchanged: boolean;
    expansionLineCount: number;
    collapsedContextThreshold: number;
    lineDiffType: "word-alt" | "word" | "char" | "none";
    disableLineNumbers: boolean;
    overflow: "scroll" | "wrap";
    collapseViewedFilesByDefault: boolean;
    autoMarkViewedFiles: boolean;
};

type TreeSettingsRecord = BaseCollectionRecord & {
    id: typeof TREE_SETTINGS_RECORD_ID;
    compactSingleChildDirectories: boolean;
    treeIndentSize: number;
};

type ShortcutConfigRecord = {
    key: string;
    modifiers: {
        ctrl?: boolean;
        alt?: boolean;
        shift?: boolean;
        meta?: boolean;
    };
    description: string;
};

type ShortcutsRecord = BaseCollectionRecord & {
    id: typeof SHORTCUTS_RECORD_ID;
    nextUnviewedFile: ShortcutConfigRecord;
    previousUnviewedFile: ShortcutConfigRecord;
    scrollDown: ShortcutConfigRecord;
    scrollUp: ShortcutConfigRecord;
    nextFile: ShortcutConfigRecord;
    previousFile: ShortcutConfigRecord;
    markFileViewed: ShortcutConfigRecord;
    markFileViewedAndFold: ShortcutConfigRecord;
    approvePullRequest: ShortcutConfigRecord;
    requestChangesPullRequest: ShortcutConfigRecord;
};

type HostPreferencesRecord = BaseCollectionRecord & {
    id: typeof HOST_PREFERENCES_RECORD_ID;
    activeHost: GitHost;
    reposByHost: Record<GitHost, RepoRef[]>;
};

type BitbucketAuthCredentialRecord = BaseCollectionRecord & {
    id: "bitbucket";
    host: "bitbucket";
    email: string;
    apiToken: string;
};

type GithubAuthCredentialRecord = BaseCollectionRecord & {
    id: "github";
    host: "github";
    token: string;
};

type ReviewViewedStateRecord = BaseCollectionRecord & {
    id: string;
    viewedVersionIds: string[];
};

type ReviewDirectoryStateRecord = BaseCollectionRecord & {
    id: string;
    expandedByPath: Record<string, boolean>;
};

type ReviewViewMode = "single" | "all";

type ReviewLayoutStateRecord = BaseCollectionRecord & {
    id: typeof REVIEW_LAYOUT_RECORD_ID;
    treeWidth: number;
    treeCollapsed: boolean;
    viewMode: ReviewViewMode;
};

type InlineDraftSide = "additions" | "deletions";

type InlineCommentDraftRecord = BaseCollectionRecord & {
    id: string;
    scopeId: string;
    path: string;
    line: number;
    side: InlineDraftSide;
    content: string;
};

type InlineCommentActiveDraftRecord = BaseCollectionRecord & {
    id: string;
    scopeId: string;
    path: string;
    line: number;
    side: InlineDraftSide;
};

type AppMetadataRecord = BaseCollectionRecord & {
    id: string;
    value: string;
};

type AppCollectionBackendMode = "indexeddb" | "memory";

type TierDebugSummary = {
    count: number;
    approxBytes: number;
    oldestUpdatedAt: number | null;
    newestUpdatedAt: number | null;
};

export type DataCollectionDebugSummary = {
    name: string;
    tier: StorageTier;
    count: number;
    approxBytes: number;
    oldestUpdatedAt: number | null;
    newestUpdatedAt: number | null;
    oldestExpiresAt: number | null;
    newestExpiresAt: number | null;
    expiredCount: number;
};

export type DataCollectionsDebugSnapshot = {
    backendMode: AppCollectionBackendMode;
    hostBackendMode: GitHostDataDebugSnapshot["backendMode"];
    persistenceDegraded: boolean;
    estimatedUsageBytes: number | null;
    estimatedQuotaBytes: number | null;
    totalRecords: number;
    totalBytes: number;
    lastSweepAt: number | null;
    tiers: Record<StorageTier, TierDebugSummary>;
    collections: DataCollectionDebugSummary[];
};

let appDataReadyPromise: Promise<void> | null = null;
let appDataDatabase: { close: () => Promise<boolean> } | null = null;
let appDataFallbackActive = false;
let appDataPersistenceDegraded = false;
let lastAppDataSweepAt: number | null = null;

let appPreferencesCollection: Collection<AppPreferenceRecord, string> | null = null;
let reviewViewedStateCollection: Collection<ReviewViewedStateRecord, string> | null = null;
let reviewDirectoryStateCollection: Collection<ReviewDirectoryStateRecord, string> | null = null;
let reviewLayoutStateCollection: Collection<ReviewLayoutStateRecord, string> | null = null;
let inlineCommentDraftsCollection: Collection<InlineCommentDraftRecord, string> | null = null;
let inlineCommentActiveDraftCollection: Collection<InlineCommentActiveDraftRecord, string> | null = null;
let appMetadataCollection: Collection<AppMetadataRecord, string> | null = null;

function approxRecordBytes(record: object) {
    return new TextEncoder().encode(JSON.stringify(record)).length;
}

function storageEstimate() {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
        return Promise.resolve({ usage: null, quota: null });
    }
    return navigator.storage
        .estimate()
        .then((estimate) => ({
            usage: typeof estimate.usage === "number" ? estimate.usage : null,
            quota: typeof estimate.quota === "number" ? estimate.quota : null,
        }))
        .catch(() => ({ usage: null, quota: null }));
}

function stateExpiresAt(from: number) {
    return from + STATE_TTL_MS;
}

function isExpiredRecord(record: { expiresAt?: number | null }, now: number) {
    return typeof record.expiresAt === "number" && record.expiresAt <= now;
}

function createBaseSchema(maxLength = 300) {
    return {
        id: {
            type: "string",
            maxLength,
        },
        updatedAt: {
            type: "number",
            minimum: 0,
        },
        expiresAt: {
            type: ["number", "null"],
        },
    } as const;
}

const APP_PREFERENCES_SCHEMA = {
    title: "pullrequestdotreview app preferences",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(120),
        value: {
            type: "object",
            additionalProperties: true,
        },
    },
    required: ["id", "updatedAt", "expiresAt", "value"],
    additionalProperties: false,
} as const;

const REVIEW_VIEWED_STATE_SCHEMA = {
    title: "pullrequestdotreview review viewed state",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(900),
        viewedVersionIds: {
            type: "array",
            items: { type: "string" },
        },
    },
    required: ["id", "updatedAt", "expiresAt", "viewedVersionIds"],
    additionalProperties: false,
} as const;

const REVIEW_DIRECTORY_STATE_SCHEMA = {
    title: "pullrequestdotreview review directory state",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(900),
        expandedByPath: {
            type: "object",
            additionalProperties: {
                type: "boolean",
            },
        },
    },
    required: ["id", "updatedAt", "expiresAt", "expandedByPath"],
    additionalProperties: false,
} as const;

const REVIEW_LAYOUT_STATE_SCHEMA = {
    title: "pullrequestdotreview review layout state",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(80),
        treeWidth: { type: "number" },
        treeCollapsed: { type: "boolean" },
        viewMode: { type: "string", maxLength: 20 },
    },
    required: ["id", "updatedAt", "expiresAt", "treeWidth", "treeCollapsed", "viewMode"],
    additionalProperties: false,
} as const;

const INLINE_COMMENT_DRAFTS_SCHEMA = {
    title: "pullrequestdotreview inline comment drafts",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(1600),
        scopeId: { type: "string", maxLength: 900 },
        path: { type: "string", maxLength: 1000 },
        line: { type: "number" },
        side: { type: "string", maxLength: 20 },
        content: { type: "string" },
    },
    required: ["id", "updatedAt", "expiresAt", "scopeId", "path", "line", "side", "content"],
    additionalProperties: false,
} as const;

const INLINE_COMMENT_ACTIVE_DRAFT_SCHEMA = {
    title: "pullrequestdotreview inline comment active draft",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(900),
        scopeId: { type: "string", maxLength: 900 },
        path: { type: "string", maxLength: 1000 },
        line: { type: "number" },
        side: { type: "string", maxLength: 20 },
    },
    required: ["id", "updatedAt", "expiresAt", "scopeId", "path", "line", "side"],
    additionalProperties: false,
} as const;

const APP_METADATA_SCHEMA = {
    title: "pullrequestdotreview app metadata",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(120),
        value: { type: "string" },
    },
    required: ["id", "updatedAt", "expiresAt", "value"],
    additionalProperties: false,
} as const;

function ensureCollectionsInitialized() {
    if (
        appPreferencesCollection &&
        reviewViewedStateCollection &&
        reviewDirectoryStateCollection &&
        reviewLayoutStateCollection &&
        inlineCommentDraftsCollection &&
        inlineCommentActiveDraftCollection &&
        appMetadataCollection
    ) {
        return;
    }

    appPreferencesCollection = createCollection(
        localOnlyCollectionOptions<AppPreferenceRecord, string>({
            id: APP_PREFERENCES_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    reviewViewedStateCollection = createCollection(
        localOnlyCollectionOptions<ReviewViewedStateRecord, string>({
            id: REVIEW_VIEWED_STATE_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    reviewDirectoryStateCollection = createCollection(
        localOnlyCollectionOptions<ReviewDirectoryStateRecord, string>({
            id: REVIEW_DIRECTORY_STATE_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    reviewLayoutStateCollection = createCollection(
        localOnlyCollectionOptions<ReviewLayoutStateRecord, string>({
            id: REVIEW_LAYOUT_STATE_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    inlineCommentDraftsCollection = createCollection(
        localOnlyCollectionOptions<InlineCommentDraftRecord, string>({
            id: INLINE_COMMENT_DRAFTS_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    inlineCommentActiveDraftCollection = createCollection(
        localOnlyCollectionOptions<InlineCommentActiveDraftRecord, string>({
            id: INLINE_COMMENT_ACTIVE_DRAFT_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    appMetadataCollection = createCollection(
        localOnlyCollectionOptions<AppMetadataRecord, string>({
            id: APP_METADATA_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );
}

async function initRxdbCollections() {
    if (typeof window === "undefined") {
        ensureCollectionsInitialized();
        appDataFallbackActive = true;
        return;
    }

    const [{ createRxDatabase }, { getRxStorageDexie }] = await Promise.all([import("rxdb/plugins/core"), import("rxdb/plugins/storage-dexie")]);

    const database = await createRxDatabase({
        name: DATA_DATABASE_NAME,
        storage: getRxStorageDexie(),
        multiInstance: true,
        closeDuplicates: true,
    });
    appDataDatabase = database;

    const collectionDefinitions = {
        [APP_PREFERENCES_COLLECTION_NAME]: {
            schema: APP_PREFERENCES_SCHEMA,
        },
        [REVIEW_VIEWED_STATE_COLLECTION_NAME]: {
            schema: REVIEW_VIEWED_STATE_SCHEMA,
        },
        [REVIEW_DIRECTORY_STATE_COLLECTION_NAME]: {
            schema: REVIEW_DIRECTORY_STATE_SCHEMA,
        },
        [REVIEW_LAYOUT_STATE_COLLECTION_NAME]: {
            schema: REVIEW_LAYOUT_STATE_SCHEMA,
        },
        [INLINE_COMMENT_DRAFTS_COLLECTION_NAME]: {
            schema: INLINE_COMMENT_DRAFTS_SCHEMA,
        },
        [INLINE_COMMENT_ACTIVE_DRAFT_COLLECTION_NAME]: {
            schema: INLINE_COMMENT_ACTIVE_DRAFT_SCHEMA,
        },
        [APP_METADATA_COLLECTION_NAME]: {
            schema: APP_METADATA_SCHEMA,
        },
    } as const;

    for (const [collectionName, collectionSchema] of Object.entries(collectionDefinitions)) {
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
    const missingCollectionNames = Object.keys(collectionDefinitions).filter((name) => !collections[name]);
    if (missingCollectionNames.length > 0) {
        throw new Error(`Data RxDB collections unavailable after init: ${missingCollectionNames.join(", ")}`);
    }

    appPreferencesCollection = createCollection(
        rxdbCollectionOptions<AppPreferenceRecord>({
            id: APP_PREFERENCES_COLLECTION_ID,
            rxCollection: collections[APP_PREFERENCES_COLLECTION_NAME],
            startSync: true,
        }),
    );

    reviewViewedStateCollection = createCollection(
        rxdbCollectionOptions<ReviewViewedStateRecord>({
            id: REVIEW_VIEWED_STATE_COLLECTION_ID,
            rxCollection: collections[REVIEW_VIEWED_STATE_COLLECTION_NAME],
            startSync: true,
        }),
    );

    reviewDirectoryStateCollection = createCollection(
        rxdbCollectionOptions<ReviewDirectoryStateRecord>({
            id: REVIEW_DIRECTORY_STATE_COLLECTION_ID,
            rxCollection: collections[REVIEW_DIRECTORY_STATE_COLLECTION_NAME],
            startSync: true,
        }),
    );

    reviewLayoutStateCollection = createCollection(
        rxdbCollectionOptions<ReviewLayoutStateRecord>({
            id: REVIEW_LAYOUT_STATE_COLLECTION_ID,
            rxCollection: collections[REVIEW_LAYOUT_STATE_COLLECTION_NAME],
            startSync: true,
        }),
    );

    inlineCommentDraftsCollection = createCollection(
        rxdbCollectionOptions<InlineCommentDraftRecord>({
            id: INLINE_COMMENT_DRAFTS_COLLECTION_ID,
            rxCollection: collections[INLINE_COMMENT_DRAFTS_COLLECTION_NAME],
            startSync: true,
        }),
    );

    inlineCommentActiveDraftCollection = createCollection(
        rxdbCollectionOptions<InlineCommentActiveDraftRecord>({
            id: INLINE_COMMENT_ACTIVE_DRAFT_COLLECTION_ID,
            rxCollection: collections[INLINE_COMMENT_ACTIVE_DRAFT_COLLECTION_NAME],
            startSync: true,
        }),
    );

    appMetadataCollection = createCollection(
        rxdbCollectionOptions<AppMetadataRecord>({
            id: APP_METADATA_COLLECTION_ID,
            rxCollection: collections[APP_METADATA_COLLECTION_NAME],
            startSync: true,
        }),
    );

    await Promise.all([
        appPreferencesCollection.preload(),
        reviewViewedStateCollection.preload(),
        reviewDirectoryStateCollection.preload(),
        reviewLayoutStateCollection.preload(),
        inlineCommentDraftsCollection.preload(),
        inlineCommentActiveDraftCollection.preload(),
        appMetadataCollection.preload(),
    ]);
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

function isTransientPersistenceError(error: unknown) {
    if (!error) return false;
    if (isRxErrorCode(error, "COL23") || isRxErrorCode(error, "DB8")) {
        return true;
    }
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            message.includes("closed") ||
            message.includes("abort") ||
            message.includes("aborted") ||
            message.includes("is disposed") ||
            message.includes("is destroyed")
        );
    }
    return false;
}

function markPersistenceIssue(error: unknown, context: string) {
    if (context.startsWith("delete:viewed:")) {
        return;
    }
    if (isTransientPersistenceError(error)) {
        return;
    }
    const firstIssue = !appDataPersistenceDegraded;
    appDataPersistenceDegraded = true;
    if (!firstIssue) return;
    if (isQuotaExceededError(error)) {
        console.warn(`Collection persistence quota exceeded during ${context}; keeping runtime state in memory.`, error);
        return;
    }
    console.warn(`Collection persistence degraded during ${context}; continuing with in-memory state.`);
}

async function persistTransaction(persistPromise: Promise<unknown>, context: string) {
    try {
        await persistPromise;
    } catch (error) {
        markPersistenceIssue(error, context);
    }
}

function deleteIndexedDbDatabase(name: string) {
    if (typeof indexedDB === "undefined") return Promise.resolve();

    return new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
    });
}

async function clearLegacyLocalStorageKeys() {
    if (typeof window === "undefined") return;
    try {
        const keys: string[] = [];
        for (let index = 0; index < window.localStorage.length; index += 1) {
            const key = window.localStorage.key(index);
            if (!key || !key.startsWith(LOCAL_STORAGE_RESET_PREFIX)) continue;
            keys.push(key);
        }

        for (const key of keys) {
            window.localStorage.removeItem(key);
        }
    } catch {
        // Ignore localStorage access issues.
    }
}

async function upsertRecord<T extends { id: string }>(collection: Collection<T, string>, record: T, context: string) {
    try {
        const existing = collection.get(record.id);
        if (!existing) {
            const transaction = collection.insert(record);
            await persistTransaction(transaction.isPersisted.promise, `insert:${context}`);
            return;
        }

        const transaction = collection.update(record.id, (draft) => {
            Object.assign(draft as Record<string, unknown>, record);
        });
        await persistTransaction(transaction.isPersisted.promise, `update:${context}`);
    } catch (error) {
        markPersistenceIssue(error, `upsert:${context}`);
    }
}

async function deleteRecord<T extends { id: string }>(collection: Collection<T, string>, id: string, context: string) {
    try {
        if (!collection.has(id)) return;
        const transaction = collection.delete(id);
        await persistTransaction(transaction.isPersisted.promise, `delete:${context}`);
    } catch (error) {
        markPersistenceIssue(error, `delete:${context}`);
    }
}

function getAppPreferencesCollection() {
    ensureCollectionsInitialized();
    if (!appPreferencesCollection) {
        throw new Error("App preferences collection is unavailable");
    }
    return appPreferencesCollection;
}

function readPermanentRecord<T extends Record<string, unknown>>(id: string): (T & BaseCollectionRecord & { id: string }) | null {
    const record = getAppPreferencesCollection().get(id);
    if (!record) return null;
    return {
        id: record.id,
        updatedAt: record.updatedAt,
        expiresAt: record.expiresAt,
        ...(record.value as T),
    };
}

function writePermanentRecord(id: string, value: Record<string, unknown>, context: string) {
    const now = Date.now();
    void upsertRecord(
        getAppPreferencesCollection(),
        {
            id,
            value,
            updatedAt: now,
            expiresAt: null,
        },
        context,
    );
}

function getReviewViewedStateCollection() {
    ensureCollectionsInitialized();
    if (!reviewViewedStateCollection) {
        throw new Error("Review viewed state collection is unavailable");
    }
    return reviewViewedStateCollection;
}

function getReviewDirectoryStateCollection() {
    ensureCollectionsInitialized();
    if (!reviewDirectoryStateCollection) {
        throw new Error("Review directory state collection is unavailable");
    }
    return reviewDirectoryStateCollection;
}

function getReviewLayoutStateCollection() {
    ensureCollectionsInitialized();
    if (!reviewLayoutStateCollection) {
        throw new Error("Review layout state collection is unavailable");
    }
    return reviewLayoutStateCollection;
}

function getInlineCommentDraftsCollection() {
    ensureCollectionsInitialized();
    if (!inlineCommentDraftsCollection) {
        throw new Error("Inline comment drafts collection is unavailable");
    }
    return inlineCommentDraftsCollection;
}

function getInlineCommentActiveDraftCollection() {
    ensureCollectionsInitialized();
    if (!inlineCommentActiveDraftCollection) {
        throw new Error("Inline comment active draft collection is unavailable");
    }
    return inlineCommentActiveDraftCollection;
}

function getAppMetadataCollection() {
    ensureCollectionsInitialized();
    if (!appMetadataCollection) {
        throw new Error("App metadata collection is unavailable");
    }
    return appMetadataCollection;
}

async function runLegacyResetIfNeeded() {
    const metadataCollection = getAppMetadataCollection();
    const marker = metadataCollection.get(LEGACY_RESET_METADATA_ID);
    if (marker?.value === "done") {
        return;
    }

    await Promise.all([deleteIndexedDbDatabase("pullrequestdotreview_settings"), deleteIndexedDbDatabase("pullrequestdotreview_host_data_v4")]);
    await clearLegacyLocalStorageKeys();

    const now = Date.now();
    await upsertRecord(
        metadataCollection,
        {
            id: LEGACY_RESET_METADATA_ID,
            value: "done",
            updatedAt: now,
            expiresAt: null,
        },
        LEGACY_RESET_METADATA_ID,
    );
}

export function ensureDataCollectionsReady() {
    if (!appDataReadyPromise) {
        appDataReadyPromise = initRxdbCollections()
            .catch((error) => {
                console.error("Failed to initialize data collections in IndexedDB, falling back to in-memory collections.", error);
                ensureCollectionsInitialized();
                appDataFallbackActive = true;
            })
            .then(async () => {
                await runLegacyResetIfNeeded();
                await sweepExpiredStateCollections();
                await ensureGitHostDataReady();
            });
    }

    return appDataReadyPromise;
}

function normalizeReposByHost(reposByHost: Record<GitHost, RepoRef[]>): Record<GitHost, RepoRef[]> {
    const normalizeHostRepos = (host: GitHost, repos: RepoRef[]) => {
        const deduped = new Map<string, RepoRef>();
        for (const repo of repos) {
            if (!repo || repo.host !== host) continue;
            const workspace = repo.workspace.trim();
            const repositorySlug = repo.repo.trim();
            if (!workspace || !repositorySlug) continue;
            const fullName = typeof repo.fullName === "string" && repo.fullName.trim().length > 0 ? repo.fullName.trim() : `${workspace}/${repositorySlug}`;
            const displayName = typeof repo.displayName === "string" && repo.displayName.trim().length > 0 ? repo.displayName.trim() : repositorySlug;
            const normalized: RepoRef = {
                host,
                workspace,
                repo: repositorySlug,
                fullName,
                displayName,
            };
            deduped.set(`${host}:${fullName}`, normalized);
        }
        return Array.from(deduped.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
    };

    return {
        bitbucket: normalizeHostRepos("bitbucket", reposByHost.bitbucket ?? []),
        github: normalizeHostRepos("github", reposByHost.github ?? []),
    };
}

export function readAppearanceSettingsRecord() {
    return readPermanentRecord<Omit<AppearanceSettingsRecord, keyof BaseCollectionRecord | "id">>(APPEARANCE_RECORD_ID) as AppearanceSettingsRecord | null;
}

export function writeAppearanceSettingsRecord(settings: Omit<AppearanceSettingsRecord, "id" | "updatedAt" | "expiresAt">) {
    writePermanentRecord(APPEARANCE_RECORD_ID, settings as Record<string, unknown>, APPEARANCE_RECORD_ID);
}

export function readDiffOptionsRecord() {
    return readPermanentRecord<Omit<DiffOptionsRecord, keyof BaseCollectionRecord | "id">>(DIFF_OPTIONS_RECORD_ID) as DiffOptionsRecord | null;
}

export function writeDiffOptionsRecord(options: Omit<DiffOptionsRecord, "id" | "updatedAt" | "expiresAt">) {
    writePermanentRecord(DIFF_OPTIONS_RECORD_ID, options as Record<string, unknown>, DIFF_OPTIONS_RECORD_ID);
}

export function readTreeSettingsRecord() {
    return readPermanentRecord<Omit<TreeSettingsRecord, keyof BaseCollectionRecord | "id">>(TREE_SETTINGS_RECORD_ID) as TreeSettingsRecord | null;
}

export function writeTreeSettingsRecord(settings: Omit<TreeSettingsRecord, "id" | "updatedAt" | "expiresAt">) {
    writePermanentRecord(TREE_SETTINGS_RECORD_ID, settings as Record<string, unknown>, TREE_SETTINGS_RECORD_ID);
}

export function readShortcutsRecord() {
    return readPermanentRecord<Omit<ShortcutsRecord, keyof BaseCollectionRecord | "id">>(SHORTCUTS_RECORD_ID) as ShortcutsRecord | null;
}

export function writeShortcutsRecord(shortcuts: Omit<ShortcutsRecord, "id" | "updatedAt" | "expiresAt">) {
    writePermanentRecord(SHORTCUTS_RECORD_ID, shortcuts as Record<string, unknown>, SHORTCUTS_RECORD_ID);
}

export function readHostPreferencesRecord() {
    return readPermanentRecord<Omit<HostPreferencesRecord, keyof BaseCollectionRecord | "id">>(HOST_PREFERENCES_RECORD_ID) as HostPreferencesRecord | null;
}

export function writeHostPreferencesRecord(data: { activeHost: GitHost; reposByHost: Record<GitHost, RepoRef[]> }) {
    writePermanentRecord(
        HOST_PREFERENCES_RECORD_ID,
        {
            activeHost: data.activeHost,
            reposByHost: normalizeReposByHost(data.reposByHost),
        },
        HOST_PREFERENCES_RECORD_ID,
    );
}

export function readReviewPerfV2FlagRecord() {
    const record = readPermanentRecord<{ enabled?: boolean }>(REVIEW_PERF_V2_FLAG_RECORD_ID);
    if (!record) return null;
    return typeof record.enabled === "boolean" ? record.enabled : null;
}

export function writeReviewPerfV2FlagRecord(enabled: boolean) {
    writePermanentRecord(
        REVIEW_PERF_V2_FLAG_RECORD_ID,
        {
            enabled,
        },
        REVIEW_PERF_V2_FLAG_RECORD_ID,
    );
}

function reviewDerivedCacheRecordId(cacheKey: string) {
    return `review-derived:${cacheKey}`;
}

export function readReviewDerivedCacheValue<T>(cacheKey: string): T | null {
    const id = reviewDerivedCacheRecordId(cacheKey);
    const record = getAppMetadataCollection().get(id);
    if (!record) return null;
    if (isExpiredRecord(record, Date.now())) {
        void deleteRecord(getAppMetadataCollection(), id, id);
        return null;
    }
    try {
        return JSON.parse(record.value) as T;
    } catch {
        return null;
    }
}

export function writeReviewDerivedCacheValue(cacheKey: string, payload: unknown) {
    const id = reviewDerivedCacheRecordId(cacheKey);
    const serializedPayload = JSON.stringify(payload);
    if (new TextEncoder().encode(serializedPayload).length > REVIEW_DERIVED_CACHE_MAX_BYTES) {
        return;
    }
    const now = Date.now();
    const metadataCollection = getAppMetadataCollection();
    const derivedRecords = Array.from(metadataCollection.values())
        .filter((record) => record.id.startsWith("review-derived:"))
        .sort((left, right) => left.updatedAt - right.updatedAt);

    void (async () => {
        const overflow = derivedRecords.length - REVIEW_DERIVED_CACHE_MAX_RECORDS;
        if (overflow >= 0) {
            for (let index = 0; index <= overflow; index += 1) {
                const evicted = derivedRecords[index];
                if (!evicted || evicted.id === id) continue;
                await deleteRecord(metadataCollection, evicted.id, evicted.id);
            }
        }
        await upsertRecord(
            metadataCollection,
            {
                id,
                value: serializedPayload,
                updatedAt: now,
                expiresAt: now + REVIEW_DERIVED_CACHE_TTL_MS,
            },
            id,
        );
    })();
}

export function readBitbucketAuthCredential() {
    const record = readPermanentRecord<Omit<BitbucketAuthCredentialRecord, keyof BaseCollectionRecord | "id">>("bitbucket");
    if (!record || record.host !== "bitbucket") return null;
    if (typeof record.email !== "string" || typeof record.apiToken !== "string") return null;
    return {
        email: record.email,
        apiToken: record.apiToken,
    };
}

export function writeBitbucketAuthCredential(data: { email: string; apiToken: string }) {
    writePermanentRecord(
        "bitbucket",
        {
            host: "bitbucket",
            email: data.email,
            apiToken: data.apiToken,
        },
        "auth:bitbucket",
    );
}

export function clearBitbucketAuthCredential() {
    void deleteRecord(getAppPreferencesCollection(), "bitbucket", "auth:bitbucket");
}

export function readGithubAuthCredential() {
    const record = readPermanentRecord<Omit<GithubAuthCredentialRecord, keyof BaseCollectionRecord | "id">>("github");
    if (!record || record.host !== "github") return null;
    if (typeof record.token !== "string") return null;
    return {
        token: record.token,
    };
}

export function writeGithubAuthCredential(data: { token: string }) {
    writePermanentRecord(
        "github",
        {
            host: "github",
            token: data.token,
        },
        "auth:github",
    );
}

export function clearGithubAuthCredential() {
    void deleteRecord(getAppPreferencesCollection(), "github", "auth:github");
}

function readStateRecord<T extends { expiresAt: number | null; id: string }>(collection: Collection<T, string>, id: string) {
    const record = collection.get(id);
    if (!record) return null;
    if (isExpiredRecord(record, Date.now())) {
        void deleteRecord(collection, id, id);
        return null;
    }
    return record;
}

export function readReviewViewedVersionIds(scopeId: string) {
    if (!scopeId) return new Set<string>();
    const record = readStateRecord(getReviewViewedStateCollection(), scopeId);
    if (!record) return new Set<string>();
    return new Set(record.viewedVersionIds);
}

export function writeReviewViewedVersionIds(scopeId: string, viewedVersionIds: Set<string>) {
    if (!scopeId) return;
    if (viewedVersionIds.size === 0) {
        void deleteRecord(getReviewViewedStateCollection(), scopeId, `viewed:${scopeId}`);
        return;
    }

    const now = Date.now();
    void upsertRecord(
        getReviewViewedStateCollection(),
        {
            id: scopeId,
            viewedVersionIds: Array.from(viewedVersionIds),
            updatedAt: now,
            expiresAt: stateExpiresAt(now),
        },
        `viewed:${scopeId}`,
    );
}

export function readReviewDirectoryState(scopeId: string) {
    if (!scopeId) return null;
    const record = readStateRecord(getReviewDirectoryStateCollection(), scopeId);
    if (!record) return null;
    return { ...record.expandedByPath };
}

export function writeReviewDirectoryState(scopeId: string, expandedByPath: Record<string, boolean>) {
    if (!scopeId) return;
    const now = Date.now();
    void upsertRecord(
        getReviewDirectoryStateCollection(),
        {
            id: scopeId,
            expandedByPath,
            updatedAt: now,
            expiresAt: stateExpiresAt(now),
        },
        `directory:${scopeId}`,
    );
}

export function readReviewLayoutState() {
    return readStateRecord(getReviewLayoutStateCollection(), REVIEW_LAYOUT_RECORD_ID);
}

export function writeReviewLayoutState(data: Omit<ReviewLayoutStateRecord, "id" | "updatedAt" | "expiresAt">) {
    const now = Date.now();
    void upsertRecord(
        getReviewLayoutStateCollection(),
        {
            id: REVIEW_LAYOUT_RECORD_ID,
            ...data,
            updatedAt: now,
            expiresAt: stateExpiresAt(now),
        },
        REVIEW_LAYOUT_RECORD_ID,
    );
}

type InlineCommentDraftLocation = {
    path: string;
    line: number;
    side: InlineDraftSide;
};

function inlineDraftRecordId(scopeId: string, draft: InlineCommentDraftLocation) {
    return `${scopeId}:${draft.side}:${draft.line}:${encodeURIComponent(draft.path)}`;
}

export function readInlineCommentDraftContent(scopeId: string, draft: InlineCommentDraftLocation) {
    if (!scopeId) return "";
    const record = readStateRecord(getInlineCommentDraftsCollection(), inlineDraftRecordId(scopeId, draft));
    return record?.content ?? "";
}

export function writeInlineCommentDraftContent(scopeId: string, draft: InlineCommentDraftLocation, content: string) {
    if (!scopeId) return;
    const draftCollection = getInlineCommentDraftsCollection();
    const draftId = inlineDraftRecordId(scopeId, draft);

    if (!content.trim()) {
        void deleteRecord(draftCollection, draftId, draftId);
        return;
    }

    const now = Date.now();
    void upsertRecord(
        draftCollection,
        {
            id: draftId,
            scopeId,
            path: draft.path,
            line: draft.line,
            side: draft.side,
            content,
            updatedAt: now,
            expiresAt: stateExpiresAt(now),
        },
        draftId,
    );
}

export function clearInlineCommentDraftContent(scopeId: string, draft: InlineCommentDraftLocation) {
    if (!scopeId) return;
    void deleteRecord(getInlineCommentDraftsCollection(), inlineDraftRecordId(scopeId, draft), inlineDraftRecordId(scopeId, draft));
}

export function readInlineCommentActiveDraft(scopeId: string): InlineCommentDraftLocation | null {
    if (!scopeId) return null;
    const record = readStateRecord(getInlineCommentActiveDraftCollection(), scopeId);
    if (!record) return null;
    return {
        path: record.path,
        line: record.line,
        side: record.side,
    };
}

export function writeInlineCommentActiveDraft(scopeId: string, draft: InlineCommentDraftLocation) {
    if (!scopeId) return;
    const now = Date.now();
    void upsertRecord(
        getInlineCommentActiveDraftCollection(),
        {
            id: scopeId,
            scopeId,
            path: draft.path,
            line: draft.line,
            side: draft.side,
            updatedAt: now,
            expiresAt: stateExpiresAt(now),
        },
        `inline-active:${scopeId}`,
    );
}

export function clearInlineCommentActiveDraft(scopeId: string) {
    if (!scopeId) return;
    void deleteRecord(getInlineCommentActiveDraftCollection(), scopeId, `inline-active:${scopeId}`);
}

export function listInlineCommentDrafts(scopeId: string): Array<InlineCommentDraftLocation & { content: string; updatedAt: number }> {
    if (!scopeId) return [];
    const now = Date.now();
    const results: Array<InlineCommentDraftLocation & { content: string; updatedAt: number }> = [];

    for (const record of getInlineCommentDraftsCollection().values()) {
        if (record.scopeId !== scopeId) continue;
        if (isExpiredRecord(record, now)) {
            void deleteRecord(getInlineCommentDraftsCollection(), record.id, record.id);
            continue;
        }
        if (!record.content.trim()) continue;

        results.push({
            path: record.path,
            line: record.line,
            side: record.side,
            content: record.content,
            updatedAt: record.updatedAt,
        });
    }

    results.sort((a, b) => b.updatedAt - a.updatedAt);
    return results;
}

async function sweepExpiredCollection<T extends { id: string; expiresAt: number | null }>(collection: Collection<T, string>, now: number, label: string) {
    let removed = 0;
    for (const record of collection.values()) {
        if (!isExpiredRecord(record, now)) continue;
        await deleteRecord(collection, record.id, `${label}:${record.id}`);
        removed += 1;
    }
    return removed;
}

async function sweepExpiredStateCollections(now = Date.now()) {
    ensureCollectionsInitialized();
    let removed = 0;
    removed += await sweepExpiredCollection(getReviewViewedStateCollection(), now, "viewed");
    removed += await sweepExpiredCollection(getReviewDirectoryStateCollection(), now, "directory");
    removed += await sweepExpiredCollection(getReviewLayoutStateCollection(), now, "layout");
    removed += await sweepExpiredCollection(getInlineCommentDraftsCollection(), now, "inline-draft");
    removed += await sweepExpiredCollection(getInlineCommentActiveDraftCollection(), now, "inline-active");
    lastAppDataSweepAt = now;
    return { removed };
}

type AppCollectionSummary = {
    name: string;
    tier: StorageTier;
    collection: Collection<BaseCollectionRecord, string>;
};

function getAppCollectionSummaries(): AppCollectionSummary[] {
    return [
        { name: "appPreferences", tier: "permanent", collection: getAppPreferencesCollection() as Collection<BaseCollectionRecord, string> },
        { name: "reviewViewedState", tier: "state", collection: getReviewViewedStateCollection() as Collection<BaseCollectionRecord, string> },
        { name: "reviewDirectoryState", tier: "state", collection: getReviewDirectoryStateCollection() as Collection<BaseCollectionRecord, string> },
        { name: "reviewLayoutState", tier: "state", collection: getReviewLayoutStateCollection() as Collection<BaseCollectionRecord, string> },
        { name: "inlineCommentDrafts", tier: "state", collection: getInlineCommentDraftsCollection() as Collection<BaseCollectionRecord, string> },
        { name: "inlineCommentActiveDraft", tier: "state", collection: getInlineCommentActiveDraftCollection() as Collection<BaseCollectionRecord, string> },
    ];
}

export async function getDataCollectionsDebugSnapshot(now = Date.now()): Promise<DataCollectionsDebugSnapshot> {
    ensureCollectionsInitialized();

    const tiers: Record<StorageTier, TierDebugSummary> = {
        cache: { count: 0, approxBytes: 0, oldestUpdatedAt: null, newestUpdatedAt: null },
        state: { count: 0, approxBytes: 0, oldestUpdatedAt: null, newestUpdatedAt: null },
        permanent: { count: 0, approxBytes: 0, oldestUpdatedAt: null, newestUpdatedAt: null },
    };

    const collections: DataCollectionDebugSummary[] = [];
    let totalRecords = 0;
    let totalBytes = 0;

    for (const summary of getAppCollectionSummaries()) {
        const entry: DataCollectionDebugSummary = {
            name: summary.name,
            tier: summary.tier,
            count: 0,
            approxBytes: 0,
            oldestUpdatedAt: null,
            newestUpdatedAt: null,
            oldestExpiresAt: null,
            newestExpiresAt: null,
            expiredCount: 0,
        };

        for (const record of summary.collection.values()) {
            entry.count += 1;
            const bytes = approxRecordBytes(record);
            entry.approxBytes += bytes;

            entry.oldestUpdatedAt = entry.oldestUpdatedAt === null ? record.updatedAt : Math.min(entry.oldestUpdatedAt, record.updatedAt);
            entry.newestUpdatedAt = entry.newestUpdatedAt === null ? record.updatedAt : Math.max(entry.newestUpdatedAt, record.updatedAt);

            if (typeof record.expiresAt === "number") {
                entry.oldestExpiresAt = entry.oldestExpiresAt === null ? record.expiresAt : Math.min(entry.oldestExpiresAt, record.expiresAt);
                entry.newestExpiresAt = entry.newestExpiresAt === null ? record.expiresAt : Math.max(entry.newestExpiresAt, record.expiresAt);
                if (record.expiresAt <= now) {
                    entry.expiredCount += 1;
                }
            }
        }

        totalRecords += entry.count;
        totalBytes += entry.approxBytes;
        tiers[summary.tier].count += entry.count;
        tiers[summary.tier].approxBytes += entry.approxBytes;
        const tierSummary = tiers[summary.tier];
        const tierOldest = tierSummary.oldestUpdatedAt;
        const tierNewest = tierSummary.newestUpdatedAt;
        tierSummary.oldestUpdatedAt =
            tierOldest === null ? entry.oldestUpdatedAt : entry.oldestUpdatedAt === null ? tierOldest : Math.min(tierOldest, entry.oldestUpdatedAt);
        tierSummary.newestUpdatedAt =
            tierNewest === null ? entry.newestUpdatedAt : entry.newestUpdatedAt === null ? tierNewest : Math.max(tierNewest, entry.newestUpdatedAt);

        collections.push(entry);
    }

    const hostSnapshot = await getGitHostDataDebugSnapshot(now);
    for (const [name, summary] of Object.entries(hostSnapshot.collections)) {
        const entry: DataCollectionDebugSummary = {
            name,
            tier: "cache",
            count: summary.count,
            approxBytes: summary.approxBytes,
            oldestUpdatedAt: summary.oldestFetchedAt,
            newestUpdatedAt: summary.newestFetchedAt,
            oldestExpiresAt: summary.oldestExpiresAt,
            newestExpiresAt: summary.newestExpiresAt,
            expiredCount: summary.expiredCount,
        };
        collections.push(entry);

        totalRecords += entry.count;
        totalBytes += entry.approxBytes;
        tiers.cache.count += entry.count;
        tiers.cache.approxBytes += entry.approxBytes;
        tiers.cache.oldestUpdatedAt =
            tiers.cache.oldestUpdatedAt === null
                ? entry.oldestUpdatedAt
                : entry.oldestUpdatedAt === null
                  ? tiers.cache.oldestUpdatedAt
                  : Math.min(tiers.cache.oldestUpdatedAt, entry.oldestUpdatedAt);
        tiers.cache.newestUpdatedAt =
            tiers.cache.newestUpdatedAt === null
                ? entry.newestUpdatedAt
                : entry.newestUpdatedAt === null
                  ? tiers.cache.newestUpdatedAt
                  : Math.max(tiers.cache.newestUpdatedAt, entry.newestUpdatedAt);
    }

    collections.sort((a, b) => a.name.localeCompare(b.name));

    const estimate = await storageEstimate();

    return {
        backendMode: appDataFallbackActive || hostSnapshot.backendMode === "memory" ? "memory" : "indexeddb",
        hostBackendMode: hostSnapshot.backendMode,
        persistenceDegraded: appDataPersistenceDegraded,
        estimatedUsageBytes: estimate.usage,
        estimatedQuotaBytes: estimate.quota,
        totalRecords,
        totalBytes,
        lastSweepAt:
            lastAppDataSweepAt === null
                ? hostSnapshot.lastSweepAt
                : hostSnapshot.lastSweepAt === null
                  ? lastAppDataSweepAt
                  : Math.max(lastAppDataSweepAt, hostSnapshot.lastSweepAt),
        tiers,
        collections,
    };
}

export async function clearCacheTierData() {
    ensureCollectionsInitialized();
    let removed = 0;

    for (const collectionSummary of getAppCollectionSummaries()) {
        if (collectionSummary.tier !== "cache") continue;
        for (const record of collectionSummary.collection.values()) {
            await deleteRecord(collectionSummary.collection, record.id, `${collectionSummary.name}:${record.id}`);
            removed += 1;
        }
    }

    const hostCleared = await clearGitHostCacheTierData();
    return {
        removed: removed + hostCleared.removed,
        appRemoved: removed,
        hostRemoved: hostCleared.removed,
    };
}

export async function clearExpiredDataNow(now = Date.now()) {
    const [appResult, hostResult] = await Promise.all([sweepExpiredStateCollections(now), sweepExpiredGitHostData(now)]);
    return {
        removed: appResult.removed + hostResult.removed,
        appRemoved: appResult.removed,
        hostRemoved: hostResult.removed,
    };
}

async function __resetDataCollectionsForTests() {
    if (appDataDatabase) {
        await appDataDatabase.close();
    }

    appDataDatabase = null;
    appDataReadyPromise = null;
    appDataFallbackActive = false;
    appDataPersistenceDegraded = false;
    lastAppDataSweepAt = null;

    appPreferencesCollection = null;
    reviewViewedStateCollection = null;
    reviewDirectoryStateCollection = null;
    reviewLayoutStateCollection = null;
    inlineCommentDraftsCollection = null;
    inlineCommentActiveDraftCollection = null;
    appMetadataCollection = null;
}
