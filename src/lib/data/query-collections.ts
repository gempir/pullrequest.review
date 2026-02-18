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
const LEGACY_RESET_METADATA_ID = "legacy_reset_v1";

const APPEARANCE_COLLECTION_NAME = "appearance_settings";
const DIFF_OPTIONS_COLLECTION_NAME = "diff_options";
const TREE_SETTINGS_COLLECTION_NAME = "tree_settings";
const SHORTCUTS_COLLECTION_NAME = "shortcuts_settings";
const HOST_PREFERENCES_COLLECTION_NAME = "host_preferences";
const AUTH_CREDENTIALS_COLLECTION_NAME = "auth_credentials";
const REVIEW_VIEWED_STATE_COLLECTION_NAME = "review_viewed_state";
const REVIEW_BASELINE_COMMIT_COLLECTION_NAME = "review_baseline_commit";
const REVIEW_DIRECTORY_STATE_COLLECTION_NAME = "review_directory_state";
const REVIEW_LAYOUT_STATE_COLLECTION_NAME = "review_layout_state";
const INLINE_COMMENT_DRAFTS_COLLECTION_NAME = "inline_comment_drafts";
const INLINE_COMMENT_ACTIVE_DRAFT_COLLECTION_NAME = "inline_comment_active_draft";
const APP_METADATA_COLLECTION_NAME = "app_metadata";

const APPEARANCE_COLLECTION_ID = "appearance-settings:rxdb";
const DIFF_OPTIONS_COLLECTION_ID = "diff-options:rxdb";
const TREE_SETTINGS_COLLECTION_ID = "tree-settings:rxdb";
const SHORTCUTS_COLLECTION_ID = "shortcuts:rxdb";
const HOST_PREFERENCES_COLLECTION_ID = "host-preferences:rxdb";
const AUTH_CREDENTIALS_COLLECTION_ID = "auth-credentials:rxdb";
const REVIEW_VIEWED_STATE_COLLECTION_ID = "review-viewed-state:rxdb";
const REVIEW_BASELINE_COMMIT_COLLECTION_ID = "review-baseline-commit:rxdb";
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

const LOCAL_STORAGE_RESET_PREFIX = "pr_review_";

type BaseCollectionRecord = {
    id: string;
    updatedAt: number;
    expiresAt: number | null;
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

type AuthCredentialRecord = BitbucketAuthCredentialRecord | GithubAuthCredentialRecord;

type ReviewViewedStateRecord = BaseCollectionRecord & {
    id: string;
    viewedVersionIds: string[];
};

type ReviewBaselineCommitRecord = BaseCollectionRecord & {
    id: string;
    baselineCommitHash: string;
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

let appearanceSettingsCollection: Collection<AppearanceSettingsRecord, string> | null = null;
let diffOptionsCollection: Collection<DiffOptionsRecord, string> | null = null;
let treeSettingsCollection: Collection<TreeSettingsRecord, string> | null = null;
let shortcutsCollection: Collection<ShortcutsRecord, string> | null = null;
let hostPreferencesCollection: Collection<HostPreferencesRecord, string> | null = null;
let authCredentialsCollection: Collection<AuthCredentialRecord, string> | null = null;
let reviewViewedStateCollection: Collection<ReviewViewedStateRecord, string> | null = null;
let reviewBaselineCommitCollection: Collection<ReviewBaselineCommitRecord, string> | null = null;
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

const APPEARANCE_SETTINGS_SCHEMA = {
    title: "pullrequestdotreview appearance settings",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(80),
        appThemeMode: {
            type: "string",
            maxLength: 20,
        },
        sansFontFamily: {
            type: "string",
            maxLength: 120,
        },
        monospaceFontFamily: {
            type: "string",
            maxLength: 120,
        },
        sansFontSize: {
            type: "number",
        },
        sansLineHeight: {
            type: "number",
        },
        monospaceFontSize: {
            type: "number",
        },
        monospaceLineHeight: {
            type: "number",
        },
        treeUseCustomTypography: {
            type: "boolean",
        },
        treeFontFamily: {
            type: "string",
            maxLength: 120,
        },
        treeFontSize: {
            type: "number",
        },
        treeLineHeight: {
            type: "number",
        },
    },
    required: [
        "id",
        "updatedAt",
        "expiresAt",
        "appThemeMode",
        "sansFontFamily",
        "monospaceFontFamily",
        "sansFontSize",
        "sansLineHeight",
        "monospaceFontSize",
        "monospaceLineHeight",
        "treeUseCustomTypography",
        "treeFontFamily",
        "treeFontSize",
        "treeLineHeight",
    ],
    additionalProperties: false,
} as const;

const DIFF_OPTIONS_SCHEMA = {
    title: "pullrequestdotreview diff options",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(80),
        followSystemTheme: { type: "boolean" },
        theme: { type: "string", maxLength: 80 },
        diffUseCustomTypography: { type: "boolean" },
        diffFontFamily: { type: "string", maxLength: 120 },
        diffFontSize: { type: "number" },
        diffLineHeight: { type: "number" },
        diffStyle: { type: "string", maxLength: 20 },
        diffIndicators: { type: "string", maxLength: 20 },
        disableBackground: { type: "boolean" },
        hunkSeparators: { type: "string", maxLength: 20 },
        expandUnchanged: { type: "boolean" },
        expansionLineCount: { type: "number" },
        collapsedContextThreshold: { type: "number" },
        lineDiffType: { type: "string", maxLength: 20 },
        disableLineNumbers: { type: "boolean" },
        overflow: { type: "string", maxLength: 20 },
        collapseViewedFilesByDefault: { type: "boolean" },
        autoMarkViewedFiles: { type: "boolean" },
    },
    required: [
        "id",
        "updatedAt",
        "expiresAt",
        "followSystemTheme",
        "theme",
        "diffUseCustomTypography",
        "diffFontFamily",
        "diffFontSize",
        "diffLineHeight",
        "diffStyle",
        "diffIndicators",
        "disableBackground",
        "hunkSeparators",
        "expandUnchanged",
        "expansionLineCount",
        "collapsedContextThreshold",
        "lineDiffType",
        "disableLineNumbers",
        "overflow",
        "collapseViewedFilesByDefault",
        "autoMarkViewedFiles",
    ],
    additionalProperties: false,
} as const;

const TREE_SETTINGS_SCHEMA = {
    title: "pullrequestdotreview tree settings",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(80),
        compactSingleChildDirectories: { type: "boolean" },
        treeIndentSize: { type: "number" },
    },
    required: ["id", "updatedAt", "expiresAt", "compactSingleChildDirectories", "treeIndentSize"],
    additionalProperties: false,
} as const;

const SHORTCUTS_SCHEMA = {
    title: "pullrequestdotreview shortcuts",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(80),
        nextUnviewedFile: { type: "object", additionalProperties: true },
        previousUnviewedFile: { type: "object", additionalProperties: true },
        scrollDown: { type: "object", additionalProperties: true },
        scrollUp: { type: "object", additionalProperties: true },
        nextFile: { type: "object", additionalProperties: true },
        previousFile: { type: "object", additionalProperties: true },
        markFileViewed: { type: "object", additionalProperties: true },
        markFileViewedAndFold: { type: "object", additionalProperties: true },
        approvePullRequest: { type: "object", additionalProperties: true },
        requestChangesPullRequest: { type: "object", additionalProperties: true },
    },
    required: [
        "id",
        "updatedAt",
        "expiresAt",
        "nextUnviewedFile",
        "previousUnviewedFile",
        "scrollDown",
        "scrollUp",
        "nextFile",
        "previousFile",
        "markFileViewed",
        "markFileViewedAndFold",
        "approvePullRequest",
        "requestChangesPullRequest",
    ],
    additionalProperties: false,
} as const;

const HOST_PREFERENCES_SCHEMA = {
    title: "pullrequestdotreview host preferences",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(120),
        activeHost: { type: "string", maxLength: 20 },
        reposByHost: { type: "object", additionalProperties: true },
    },
    required: ["id", "updatedAt", "expiresAt", "activeHost", "reposByHost"],
    additionalProperties: false,
} as const;

const AUTH_CREDENTIALS_SCHEMA = {
    title: "pullrequestdotreview auth credentials",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(20),
        host: { type: "string", maxLength: 20 },
        email: { type: "string", maxLength: 300 },
        apiToken: { type: "string", maxLength: 300 },
        token: { type: "string", maxLength: 300 },
    },
    required: ["id", "updatedAt", "expiresAt", "host"],
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

const REVIEW_BASELINE_COMMIT_SCHEMA = {
    title: "pullrequestdotreview review baseline commit",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        ...createBaseSchema(900),
        baselineCommitHash: {
            type: "string",
            maxLength: 80,
        },
    },
    required: ["id", "updatedAt", "expiresAt", "baselineCommitHash"],
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
        appearanceSettingsCollection &&
        diffOptionsCollection &&
        treeSettingsCollection &&
        shortcutsCollection &&
        hostPreferencesCollection &&
        authCredentialsCollection &&
        reviewViewedStateCollection &&
        reviewBaselineCommitCollection &&
        reviewDirectoryStateCollection &&
        reviewLayoutStateCollection &&
        inlineCommentDraftsCollection &&
        inlineCommentActiveDraftCollection &&
        appMetadataCollection
    ) {
        return;
    }

    appearanceSettingsCollection = createCollection(
        localOnlyCollectionOptions<AppearanceSettingsRecord, string>({
            id: APPEARANCE_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    diffOptionsCollection = createCollection(
        localOnlyCollectionOptions<DiffOptionsRecord, string>({
            id: DIFF_OPTIONS_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    treeSettingsCollection = createCollection(
        localOnlyCollectionOptions<TreeSettingsRecord, string>({
            id: TREE_SETTINGS_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    shortcutsCollection = createCollection(
        localOnlyCollectionOptions<ShortcutsRecord, string>({
            id: SHORTCUTS_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    hostPreferencesCollection = createCollection(
        localOnlyCollectionOptions<HostPreferencesRecord, string>({
            id: HOST_PREFERENCES_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    authCredentialsCollection = createCollection(
        localOnlyCollectionOptions<AuthCredentialRecord, string>({
            id: AUTH_CREDENTIALS_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    reviewViewedStateCollection = createCollection(
        localOnlyCollectionOptions<ReviewViewedStateRecord, string>({
            id: REVIEW_VIEWED_STATE_COLLECTION_ID,
            getKey: (item) => item.id,
        }),
    );

    reviewBaselineCommitCollection = createCollection(
        localOnlyCollectionOptions<ReviewBaselineCommitRecord, string>({
            id: REVIEW_BASELINE_COMMIT_COLLECTION_ID,
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
    });
    appDataDatabase = database;

    const collections = await database.addCollections({
        [APPEARANCE_COLLECTION_NAME]: {
            schema: APPEARANCE_SETTINGS_SCHEMA,
        },
        [DIFF_OPTIONS_COLLECTION_NAME]: {
            schema: DIFF_OPTIONS_SCHEMA,
        },
        [TREE_SETTINGS_COLLECTION_NAME]: {
            schema: TREE_SETTINGS_SCHEMA,
        },
        [SHORTCUTS_COLLECTION_NAME]: {
            schema: SHORTCUTS_SCHEMA,
        },
        [HOST_PREFERENCES_COLLECTION_NAME]: {
            schema: HOST_PREFERENCES_SCHEMA,
        },
        [AUTH_CREDENTIALS_COLLECTION_NAME]: {
            schema: AUTH_CREDENTIALS_SCHEMA,
        },
        [REVIEW_VIEWED_STATE_COLLECTION_NAME]: {
            schema: REVIEW_VIEWED_STATE_SCHEMA,
        },
        [REVIEW_BASELINE_COMMIT_COLLECTION_NAME]: {
            schema: REVIEW_BASELINE_COMMIT_SCHEMA,
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
    });

    appearanceSettingsCollection = createCollection(
        rxdbCollectionOptions<AppearanceSettingsRecord>({
            id: APPEARANCE_COLLECTION_ID,
            rxCollection: collections[APPEARANCE_COLLECTION_NAME],
            startSync: true,
        }),
    );

    diffOptionsCollection = createCollection(
        rxdbCollectionOptions<DiffOptionsRecord>({
            id: DIFF_OPTIONS_COLLECTION_ID,
            rxCollection: collections[DIFF_OPTIONS_COLLECTION_NAME],
            startSync: true,
        }),
    );

    treeSettingsCollection = createCollection(
        rxdbCollectionOptions<TreeSettingsRecord>({
            id: TREE_SETTINGS_COLLECTION_ID,
            rxCollection: collections[TREE_SETTINGS_COLLECTION_NAME],
            startSync: true,
        }),
    );

    shortcutsCollection = createCollection(
        rxdbCollectionOptions<ShortcutsRecord>({
            id: SHORTCUTS_COLLECTION_ID,
            rxCollection: collections[SHORTCUTS_COLLECTION_NAME],
            startSync: true,
        }),
    );

    hostPreferencesCollection = createCollection(
        rxdbCollectionOptions<HostPreferencesRecord>({
            id: HOST_PREFERENCES_COLLECTION_ID,
            rxCollection: collections[HOST_PREFERENCES_COLLECTION_NAME],
            startSync: true,
        }),
    );

    authCredentialsCollection = createCollection(
        rxdbCollectionOptions<AuthCredentialRecord>({
            id: AUTH_CREDENTIALS_COLLECTION_ID,
            rxCollection: collections[AUTH_CREDENTIALS_COLLECTION_NAME],
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

    reviewBaselineCommitCollection = createCollection(
        rxdbCollectionOptions<ReviewBaselineCommitRecord>({
            id: REVIEW_BASELINE_COMMIT_COLLECTION_ID,
            rxCollection: collections[REVIEW_BASELINE_COMMIT_COLLECTION_NAME],
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
        appearanceSettingsCollection.preload(),
        diffOptionsCollection.preload(),
        treeSettingsCollection.preload(),
        shortcutsCollection.preload(),
        hostPreferencesCollection.preload(),
        authCredentialsCollection.preload(),
        reviewViewedStateCollection.preload(),
        reviewBaselineCommitCollection.preload(),
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

function markPersistenceIssue(error: unknown, context: string) {
    appDataPersistenceDegraded = true;
    if (isQuotaExceededError(error)) {
        console.warn(`Collection persistence quota exceeded during ${context}; keeping runtime state in memory.`, error);
        return;
    }
    console.warn(`Collection persistence error during ${context}.`, error);
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
}

async function deleteRecord<T extends { id: string }>(collection: Collection<T, string>, id: string, context: string) {
    if (!collection.has(id)) return;
    const transaction = collection.delete(id);
    await persistTransaction(transaction.isPersisted.promise, `delete:${context}`);
}

function getAppearanceCollection() {
    ensureCollectionsInitialized();
    if (!appearanceSettingsCollection) {
        throw new Error("Appearance settings collection is unavailable");
    }
    return appearanceSettingsCollection;
}

function getDiffOptionsCollection() {
    ensureCollectionsInitialized();
    if (!diffOptionsCollection) {
        throw new Error("Diff options collection is unavailable");
    }
    return diffOptionsCollection;
}

function getTreeSettingsCollection() {
    ensureCollectionsInitialized();
    if (!treeSettingsCollection) {
        throw new Error("Tree settings collection is unavailable");
    }
    return treeSettingsCollection;
}

function getShortcutsCollection() {
    ensureCollectionsInitialized();
    if (!shortcutsCollection) {
        throw new Error("Shortcuts collection is unavailable");
    }
    return shortcutsCollection;
}

function getHostPreferencesCollection() {
    ensureCollectionsInitialized();
    if (!hostPreferencesCollection) {
        throw new Error("Host preferences collection is unavailable");
    }
    return hostPreferencesCollection;
}

function getAuthCredentialsCollection() {
    ensureCollectionsInitialized();
    if (!authCredentialsCollection) {
        throw new Error("Auth credentials collection is unavailable");
    }
    return authCredentialsCollection;
}

function getReviewViewedStateCollection() {
    ensureCollectionsInitialized();
    if (!reviewViewedStateCollection) {
        throw new Error("Review viewed state collection is unavailable");
    }
    return reviewViewedStateCollection;
}

function getReviewBaselineCommitCollection() {
    ensureCollectionsInitialized();
    if (!reviewBaselineCommitCollection) {
        throw new Error("Review baseline commit collection is unavailable");
    }
    return reviewBaselineCommitCollection;
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
    return getAppearanceCollection().get(APPEARANCE_RECORD_ID) ?? null;
}

export function writeAppearanceSettingsRecord(settings: Omit<AppearanceSettingsRecord, "id" | "updatedAt" | "expiresAt">) {
    const now = Date.now();
    void upsertRecord(
        getAppearanceCollection(),
        {
            id: APPEARANCE_RECORD_ID,
            ...settings,
            updatedAt: now,
            expiresAt: null,
        },
        APPEARANCE_RECORD_ID,
    );
}

export function readDiffOptionsRecord() {
    return getDiffOptionsCollection().get(DIFF_OPTIONS_RECORD_ID) ?? null;
}

export function writeDiffOptionsRecord(options: Omit<DiffOptionsRecord, "id" | "updatedAt" | "expiresAt">) {
    const now = Date.now();
    void upsertRecord(
        getDiffOptionsCollection(),
        {
            id: DIFF_OPTIONS_RECORD_ID,
            ...options,
            updatedAt: now,
            expiresAt: null,
        },
        DIFF_OPTIONS_RECORD_ID,
    );
}

export function readTreeSettingsRecord() {
    return getTreeSettingsCollection().get(TREE_SETTINGS_RECORD_ID) ?? null;
}

export function writeTreeSettingsRecord(settings: Omit<TreeSettingsRecord, "id" | "updatedAt" | "expiresAt">) {
    const now = Date.now();
    void upsertRecord(
        getTreeSettingsCollection(),
        {
            id: TREE_SETTINGS_RECORD_ID,
            ...settings,
            updatedAt: now,
            expiresAt: null,
        },
        TREE_SETTINGS_RECORD_ID,
    );
}

export function readShortcutsRecord() {
    return getShortcutsCollection().get(SHORTCUTS_RECORD_ID) ?? null;
}

export function writeShortcutsRecord(shortcuts: Omit<ShortcutsRecord, "id" | "updatedAt" | "expiresAt">) {
    const now = Date.now();
    void upsertRecord(
        getShortcutsCollection(),
        {
            id: SHORTCUTS_RECORD_ID,
            ...shortcuts,
            updatedAt: now,
            expiresAt: null,
        },
        SHORTCUTS_RECORD_ID,
    );
}

export function readHostPreferencesRecord() {
    return getHostPreferencesCollection().get(HOST_PREFERENCES_RECORD_ID) ?? null;
}

export function writeHostPreferencesRecord(data: { activeHost: GitHost; reposByHost: Record<GitHost, RepoRef[]> }) {
    const now = Date.now();
    void upsertRecord(
        getHostPreferencesCollection(),
        {
            id: HOST_PREFERENCES_RECORD_ID,
            activeHost: data.activeHost,
            reposByHost: normalizeReposByHost(data.reposByHost),
            updatedAt: now,
            expiresAt: null,
        },
        HOST_PREFERENCES_RECORD_ID,
    );
}

export function readBitbucketAuthCredential() {
    const record = getAuthCredentialsCollection().get("bitbucket");
    if (!record || record.host !== "bitbucket") return null;
    if (typeof record.email !== "string" || typeof record.apiToken !== "string") return null;
    return {
        email: record.email,
        apiToken: record.apiToken,
    };
}

export function writeBitbucketAuthCredential(data: { email: string; apiToken: string }) {
    const now = Date.now();
    void upsertRecord(
        getAuthCredentialsCollection(),
        {
            id: "bitbucket",
            host: "bitbucket",
            email: data.email,
            apiToken: data.apiToken,
            updatedAt: now,
            expiresAt: null,
        },
        "auth:bitbucket",
    );
}

export function clearBitbucketAuthCredential() {
    void deleteRecord(getAuthCredentialsCollection(), "bitbucket", "auth:bitbucket");
}

export function readGithubAuthCredential() {
    const record = getAuthCredentialsCollection().get("github");
    if (!record || record.host !== "github") return null;
    if (typeof record.token !== "string") return null;
    return {
        token: record.token,
    };
}

export function writeGithubAuthCredential(data: { token: string }) {
    const now = Date.now();
    void upsertRecord(
        getAuthCredentialsCollection(),
        {
            id: "github",
            host: "github",
            token: data.token,
            updatedAt: now,
            expiresAt: null,
        },
        "auth:github",
    );
}

export function clearGithubAuthCredential() {
    void deleteRecord(getAuthCredentialsCollection(), "github", "auth:github");
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

export function readReviewBaselineCommitHash(scopeId: string) {
    if (!scopeId) return null;
    const record = readStateRecord(getReviewBaselineCommitCollection(), scopeId);
    if (!record) return null;
    return record.baselineCommitHash;
}

export function writeReviewBaselineCommitHash(scopeId: string, baselineCommitHash: string | null) {
    if (!scopeId) return;
    const normalized = baselineCommitHash?.trim();
    if (!normalized) {
        void deleteRecord(getReviewBaselineCommitCollection(), scopeId, `baseline:${scopeId}`);
        return;
    }

    const now = Date.now();
    void upsertRecord(
        getReviewBaselineCommitCollection(),
        {
            id: scopeId,
            baselineCommitHash: normalized,
            updatedAt: now,
            expiresAt: stateExpiresAt(now),
        },
        `baseline:${scopeId}`,
    );
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
    removed += await sweepExpiredCollection(getReviewBaselineCommitCollection(), now, "baseline");
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
        { name: "appearanceSettings", tier: "permanent", collection: getAppearanceCollection() as Collection<BaseCollectionRecord, string> },
        { name: "diffOptions", tier: "permanent", collection: getDiffOptionsCollection() as Collection<BaseCollectionRecord, string> },
        { name: "treeSettings", tier: "permanent", collection: getTreeSettingsCollection() as Collection<BaseCollectionRecord, string> },
        { name: "shortcuts", tier: "permanent", collection: getShortcutsCollection() as Collection<BaseCollectionRecord, string> },
        { name: "hostPreferences", tier: "permanent", collection: getHostPreferencesCollection() as Collection<BaseCollectionRecord, string> },
        { name: "authCredentials", tier: "permanent", collection: getAuthCredentialsCollection() as Collection<BaseCollectionRecord, string> },
        { name: "reviewViewedState", tier: "state", collection: getReviewViewedStateCollection() as Collection<BaseCollectionRecord, string> },
        { name: "reviewBaselineCommit", tier: "state", collection: getReviewBaselineCommitCollection() as Collection<BaseCollectionRecord, string> },
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

    appearanceSettingsCollection = null;
    diffOptionsCollection = null;
    treeSettingsCollection = null;
    shortcutsCollection = null;
    hostPreferencesCollection = null;
    authCredentialsCollection = null;
    reviewViewedStateCollection = null;
    reviewBaselineCommitCollection = null;
    reviewDirectoryStateCollection = null;
    reviewLayoutStateCollection = null;
    inlineCommentDraftsCollection = null;
    inlineCommentActiveDraftCollection = null;
    appMetadataCollection = null;
}
