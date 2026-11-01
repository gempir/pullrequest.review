import { createStore, del, entries, set, type UseStore } from "idb-keyval";
import type { GitHost, RepoRef } from "@/lib/git-host/types";

const STATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RETIRED_DATABASE_PREFIX = "rxdb-dexie-pullrequestdotreview_";

type StoredEntry = { value: unknown; expiresAt: number | null };
type BroadcastMessage = { key: string; entry: StoredEntry | null };

// Reads stay synchronous because the whole store is small and loaded into memory at startup.
const cache = new Map<string, StoredEntry>();
let readyPromise: Promise<void> | null = null;
let idbStore: UseStore | null = null;
let channel: BroadcastChannel | null = null;
let warnedAboutPersistence = false;

function warnPersistence(error: unknown) {
    if (warnedAboutPersistence) return;
    warnedAboutPersistence = true;
    console.warn("Storage persistence failed; continuing with in-memory state.", error);
}

async function persist(key: string, entry: StoredEntry | null): Promise<void> {
    // A write can arrive while the store is still opening, such as a login on the OAuth callback page.
    await ensureStorageReady();
    channel?.postMessage({ key, entry } satisfies BroadcastMessage);
    if (!idbStore) return;
    await (entry ? set(key, entry, idbStore) : del(key, idbStore)).catch(warnPersistence);
}

function write(key: string, value: unknown, expiresAt: number | null = null) {
    const entry = { value, expiresAt };
    cache.set(key, entry);
    return persist(key, entry);
}

function remove(key: string) {
    if (!cache.delete(key)) return Promise.resolve();
    return persist(key, null);
}

function read<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
        void remove(key);
        return null;
    }
    return entry.value as T;
}

function writeState(key: string, value: unknown) {
    return write(key, value, Date.now() + STATE_TTL_MS);
}

async function deleteRetiredDatabases() {
    if (typeof indexedDB.databases !== "function") return;
    const databases = await indexedDB.databases();
    for (const { name } of databases) {
        if (name?.startsWith(RETIRED_DATABASE_PREFIX)) indexedDB.deleteDatabase(name);
    }
}

async function loadStore() {
    if (typeof indexedDB === "undefined") return;
    try {
        idbStore = createStore("pullrequestdotreview_v1", "kv");
        const now = Date.now();
        for (const [key, entry] of await entries<string, StoredEntry>(idbStore)) {
            if (entry.expiresAt !== null && entry.expiresAt <= now) {
                void del(key, idbStore).catch(warnPersistence);
                continue;
            }
            // A write made while loading is newer than what is on disk.
            if (!cache.has(key)) cache.set(key, entry);
        }
        if (typeof BroadcastChannel !== "undefined") {
            channel = new BroadcastChannel("pullrequestdotreview_storage");
            channel.onmessage = ({ data }: MessageEvent<BroadcastMessage>) => {
                if (data.entry) cache.set(data.key, data.entry);
                else cache.delete(data.key);
            };
        }
        await deleteRetiredDatabases();
    } catch (error) {
        idbStore = null;
        warnPersistence(error);
    }
}

export function ensureStorageReady() {
    readyPromise ??= loadStore();
    return readyPromise;
}

type SettingName = "appearance" | "diff-options" | "tree-settings" | "shortcuts";

export function readSetting(name: SettingName) {
    return read<Record<string, unknown>>(`setting:${name}`);
}

export function writeSetting(name: SettingName, value: object) {
    void write(`setting:${name}`, value);
}

type HostPreferences = { activeHost: GitHost; reposByHost: Record<GitHost, RepoRef[]> };

export function readHostPreferences() {
    return read<Partial<HostPreferences>>("setting:host-preferences");
}

export function writeHostPreferences(preferences: HostPreferences) {
    void write("setting:host-preferences", preferences);
}

export type BitbucketAuthCredential =
    | { host: "bitbucket"; method: "apiToken"; email: string; apiToken: string }
    | { host: "bitbucket"; method: "oauth"; accessToken: string; refreshToken?: string; expiresAt?: number };

export function readBitbucketAuthCredential() {
    return read<BitbucketAuthCredential>("auth:bitbucket");
}

export function writeBitbucketAuthCredential(data: { email: string; apiToken: string }) {
    return write("auth:bitbucket", { host: "bitbucket", method: "apiToken", ...data } satisfies BitbucketAuthCredential);
}

export function writeBitbucketOAuthCredential(data: { accessToken: string; refreshToken?: string; expiresAt?: number }) {
    return write("auth:bitbucket", { host: "bitbucket", method: "oauth", ...data } satisfies BitbucketAuthCredential);
}

export function clearBitbucketAuthCredential() {
    void remove("auth:bitbucket");
}

export function readGithubAuthCredential() {
    return read<{ token: string }>("auth:github");
}

export function writeGithubAuthCredential(data: { token: string }) {
    return write("auth:github", { token: data.token });
}

export function clearGithubAuthCredential() {
    void remove("auth:github");
}

export function readViewedVersionIds(scopeId: string, knownVersionIds?: ReadonlySet<string>) {
    const stored = scopeId ? read<string[]>(`viewed:${scopeId}`) : null;
    return new Set((stored ?? []).filter((versionId) => !knownVersionIds || knownVersionIds.has(versionId)));
}

export function writeViewedVersionIds(scopeId: string, viewedVersionIds: Set<string>) {
    if (!scopeId) return;
    if (viewedVersionIds.size === 0) {
        void remove(`viewed:${scopeId}`);
        return;
    }
    void writeState(`viewed:${scopeId}`, Array.from(viewedVersionIds));
}

export type ReviewLayoutState = {
    treeWidth: number;
    treeCollapsed: boolean;
    viewMode: "single" | "all";
    rightSidebarWidth?: number;
    rightSidebarCollapsed?: boolean;
};

export function readReviewLayoutState() {
    return read<ReviewLayoutState>("review-layout");
}

export function writeReviewLayoutState(data: ReviewLayoutState) {
    void writeState("review-layout", data);
}

export type InlineDraftLocation = { path: string; line: number; side: "additions" | "deletions" };
type StoredInlineDraft = InlineDraftLocation & { content: string; updatedAt: number };

function draftKeyPrefix(scopeId: string) {
    return `draft:${scopeId}:`;
}

function draftKey(scopeId: string, draft: InlineDraftLocation) {
    return `${draftKeyPrefix(scopeId)}${draft.side}:${draft.line}:${encodeURIComponent(draft.path)}`;
}

export function readInlineDraftContent(scopeId: string, draft: InlineDraftLocation) {
    return read<StoredInlineDraft>(draftKey(scopeId, draft))?.content ?? "";
}

export function writeInlineDraftContent(scopeId: string, draft: InlineDraftLocation, content: string) {
    if (!content.trim()) {
        void remove(draftKey(scopeId, draft));
        return;
    }
    const stored: StoredInlineDraft = { path: draft.path, line: draft.line, side: draft.side, content, updatedAt: Date.now() };
    void writeState(draftKey(scopeId, draft), stored);
}

export function clearInlineDraftContent(scopeId: string, draft: InlineDraftLocation) {
    void remove(draftKey(scopeId, draft));
}

export function readActiveInlineDraft(scopeId: string) {
    return read<InlineDraftLocation>(`active-draft:${scopeId}`);
}

export function writeActiveInlineDraft(scopeId: string, draft: InlineDraftLocation) {
    void writeState(`active-draft:${scopeId}`, { path: draft.path, line: draft.line, side: draft.side });
}

export function clearActiveInlineDraft(scopeId: string) {
    void remove(`active-draft:${scopeId}`);
}

export function listInlineDrafts(scopeId: string) {
    const prefix = draftKeyPrefix(scopeId);
    const drafts: StoredInlineDraft[] = [];
    for (const key of Array.from(cache.keys())) {
        if (!key.startsWith(prefix)) continue;
        const draft = read<StoredInlineDraft>(key);
        if (draft) drafts.push(draft);
    }
    return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
}
