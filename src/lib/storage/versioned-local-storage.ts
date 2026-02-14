import {
  ensureStorageReady,
  listStorageKeys,
  readStorageValue,
  removeStorageValue,
  writeStorageValue,
} from "@/lib/storage/client-storage-db";

export function makeVersionedStorageKey(baseKey: string, version: number) {
  return `${baseKey}:v${version}`;
}

export function readLocalStorageValue(key: string): string | null {
  if (!key) return null;
  return readStorageValue(key);
}

export function writeLocalStorageValue(key: string, value: string) {
  writeStorageValue(key, value);
}

export function removeLocalStorageKeys(keys: string[]) {
  for (const key of keys) {
    removeStorageValue(key);
  }
}

export {
  ensureStorageReady,
  listStorageKeys,
  readStorageValue,
  removeStorageValue,
  writeStorageValue,
};
