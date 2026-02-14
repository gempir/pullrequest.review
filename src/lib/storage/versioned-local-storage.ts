export function makeVersionedStorageKey(baseKey: string, version: number) {
  return `${baseKey}:v${version}`;
}

export function readMigratedLocalStorage(
  currentKey: string,
  legacyKeys: string[] = [],
): string | null {
  if (typeof window === "undefined") return null;

  try {
    const currentValue = window.localStorage.getItem(currentKey);
    if (currentValue !== null) return currentValue;

    for (const legacyKey of legacyKeys) {
      const legacyValue = window.localStorage.getItem(legacyKey);
      if (legacyValue === null) continue;

      // Keep migration lazy and lossless by copying raw serialized values.
      window.localStorage.setItem(currentKey, legacyValue);
      return legacyValue;
    }

    return null;
  } catch {
    return null;
  }
}

export function writeLocalStorageValue(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage is best-effort and can fail in private mode or when quota is exceeded.
  }
}

export function removeLocalStorageKeys(keys: string[]) {
  if (typeof window === "undefined") return;
  try {
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage cleanup failures.
  }
}
