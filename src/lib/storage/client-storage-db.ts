import { type Collection, createCollection } from "@tanstack/db";
import { rxdbCollectionOptions } from "@tanstack/rxdb-db-collection";

type StorageEntry = {
  id: string;
  value: string;
  updatedAt: number;
};

type PendingStorageOperation =
  | { type: "set"; key: string; value: string }
  | { type: "remove"; key: string };

const STORAGE_DATABASE_NAME = "pullrequestdotreview_settings";
const STORAGE_COLLECTION_NAME = "settings";
const STORAGE_COLLECTION_ID = "settings-kv";

const STORAGE_ENTRY_SCHEMA = {
  title: "pullrequestdotreview settings",
  version: 0,
  type: "object",
  primaryKey: "id",
  properties: {
    id: {
      type: "string",
      maxLength: 400,
    },
    value: {
      type: "string",
    },
    updatedAt: {
      type: "number",
      minimum: 0,
    },
  },
  required: ["id", "value", "updatedAt"],
  additionalProperties: false,
} as const;

const storageSnapshot = new Map<string, string>();
const pendingOperations: PendingStorageOperation[] = [];

let storageCollection: Collection<StorageEntry, string> | null = null;
let storageReadyPromise: Promise<void> | null = null;
let storageFlushPromise: Promise<void> | null = null;
let storageDatabase: { close: () => Promise<boolean> } | null = null;
let useLocalStorageFallback = false;

async function initStorageCollection() {
  if (storageCollection || typeof window === "undefined") return;
  if (
    typeof window.addEventListener !== "function" ||
    typeof window.removeEventListener !== "function"
  ) {
    useLocalStorageFallback = true;
    return;
  }

  const [{ createRxDatabase }, { getRxStorageLocalstorage }] =
    await Promise.all([
      import("rxdb/plugins/core"),
      import("rxdb/plugins/storage-localstorage"),
    ]);

  const database = await createRxDatabase({
    name: STORAGE_DATABASE_NAME,
    storage: getRxStorageLocalstorage(),
    multiInstance: true,
  });
  storageDatabase = database;

  const collections = await database.addCollections({
    [STORAGE_COLLECTION_NAME]: {
      schema: STORAGE_ENTRY_SCHEMA,
    },
  });

  storageCollection = createCollection(
    rxdbCollectionOptions<StorageEntry>({
      id: STORAGE_COLLECTION_ID,
      rxCollection: collections[STORAGE_COLLECTION_NAME],
      startSync: true,
    }),
  );

  await storageCollection.preload();
  storageSnapshot.clear();
  for (const entry of storageCollection.values()) {
    storageSnapshot.set(entry.id, entry.value);
  }
}

export function ensureStorageReady() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (!storageReadyPromise) {
    storageReadyPromise = initStorageCollection().catch((error) => {
      // Keep storage best-effort to avoid blocking app usage.
      console.error(
        "Failed to initialize RxDB storage, using localStorage.",
        error,
      );
      useLocalStorageFallback = true;
    });
  }
  return storageReadyPromise;
}

function flushPendingOperations() {
  if (storageFlushPromise) return storageFlushPromise;

  storageFlushPromise = (async () => {
    await ensureStorageReady();
    if (!storageCollection) return;

    while (pendingOperations.length > 0) {
      const operation = pendingOperations.shift();
      if (!operation) continue;

      if (operation.type === "set") {
        const existing = storageCollection.get(operation.key);
        if (existing) {
          const updateTransaction = storageCollection.update(
            operation.key,
            (draft) => {
              draft.value = operation.value;
              draft.updatedAt = Date.now();
            },
          );
          await updateTransaction.isPersisted.promise;
        } else {
          const insertTransaction = storageCollection.insert({
            id: operation.key,
            value: operation.value,
            updatedAt: Date.now(),
          });
          await insertTransaction.isPersisted.promise;
        }
        continue;
      }

      if (storageCollection.has(operation.key)) {
        const deleteTransaction = storageCollection.delete(operation.key);
        await deleteTransaction.isPersisted.promise;
      }
    }
  })()
    .catch(() => {
      // Ignore persistence failures and keep the in-memory snapshot.
    })
    .finally(() => {
      storageFlushPromise = null;
    });

  return storageFlushPromise;
}

export function readStorageValue(key: string) {
  if (!key) return null;

  if (useLocalStorageFallback && typeof window !== "undefined") {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  const inCollection = storageCollection?.get(key);
  if (inCollection) return inCollection.value;
  return storageSnapshot.get(key) ?? null;
}

export function writeStorageValue(key: string, value: string) {
  if (!key) return;
  if (useLocalStorageFallback && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      // Fallback to in-memory if localStorage is not writable.
    }
  }
  storageSnapshot.set(key, value);
  pendingOperations.push({ type: "set", key, value });
  void flushPendingOperations();
}

export function removeStorageValue(key: string) {
  if (!key) return;
  if (useLocalStorageFallback && typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(key);
      return;
    } catch {
      // Fallback to in-memory removal.
    }
  }
  storageSnapshot.delete(key);
  pendingOperations.push({ type: "remove", key });
  void flushPendingOperations();
}

export function listStorageKeys() {
  if (useLocalStorageFallback && typeof window !== "undefined") {
    const keys: string[] = [];
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key) continue;
        keys.push(key);
      }
    } catch {
      return [];
    }
    return keys;
  }

  const keys = new Set(storageSnapshot.keys());
  if (storageCollection) {
    for (const key of storageCollection.keys()) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

export async function __resetStorageForTests() {
  if (storageDatabase) {
    await storageDatabase.close();
  }
  storageDatabase = null;
  storageCollection = null;
  storageReadyPromise = null;
  storageFlushPromise = null;
  pendingOperations.length = 0;
  storageSnapshot.clear();
  useLocalStorageFallback = false;
}
