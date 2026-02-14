export function readJsonStorage<T>(
  key: string,
  validator: (input: unknown) => T | null,
): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return validator(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeJsonStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best effort persistence only.
  }
}

export function removeStorageValue(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best effort persistence only.
  }
}
