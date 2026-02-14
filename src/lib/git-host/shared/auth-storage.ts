import {
  readStorageValue,
  removeStorageValue as removeStoredValue,
  writeStorageValue as writeStoredValue,
} from "@/lib/storage/versioned-local-storage";

export function readJsonStorage<T>(
  key: string,
  validator: (input: unknown) => T | null,
): T | null {
  try {
    const raw = readStorageValue(key);
    if (!raw) return null;
    return validator(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeJsonStorage(key: string, value: unknown) {
  try {
    writeStoredValue(key, JSON.stringify(value));
  } catch {
    // Best effort persistence only.
  }
}

export function removeStorageValue(key: string) {
  try {
    removeStoredValue(key);
  } catch {
    // Best effort persistence only.
  }
}
