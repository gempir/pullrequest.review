import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  makeVersionedStorageKey,
  readMigratedLocalStorage,
  removeLocalStorageKeys,
  writeLocalStorageValue,
} from "../src/lib/storage/versioned-local-storage";

function createMemoryStorage() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

const globalWithWindow = globalThis;
let previousWindow;

beforeEach(() => {
  previousWindow = globalWithWindow.window;
  Object.defineProperty(globalWithWindow, "window", {
    configurable: true,
    writable: true,
    value: { localStorage: createMemoryStorage() },
  });
});

afterEach(() => {
  if (previousWindow === undefined) {
    delete globalWithWindow.window;
    return;
  }
  Object.defineProperty(globalWithWindow, "window", {
    configurable: true,
    writable: true,
    value: previousWindow,
  });
});

describe("versioned localStorage", () => {
  test("builds stable versioned keys", () => {
    expect(makeVersionedStorageKey("pr_review_shortcuts", 2)).toBe(
      "pr_review_shortcuts:v2",
    );
  });

  test("reads current key value before checking legacy keys", () => {
    globalWithWindow.window.localStorage.setItem("settings:v2", "current");
    globalWithWindow.window.localStorage.setItem("settings", "legacy");

    expect(readMigratedLocalStorage("settings:v2", ["settings"])).toBe(
      "current",
    );
  });

  test("migrates legacy value to current key on first read", () => {
    globalWithWindow.window.localStorage.setItem("settings", '{"tab":"diff"}');

    const value = readMigratedLocalStorage("settings:v2", ["settings"]);

    expect(value).toBe('{"tab":"diff"}');
    expect(globalWithWindow.window.localStorage.getItem("settings:v2")).toBe(
      '{"tab":"diff"}',
    );
  });

  test("writes and removes values defensively", () => {
    writeLocalStorageValue("one", "1");
    writeLocalStorageValue("two", "2");

    expect(globalWithWindow.window.localStorage.getItem("one")).toBe("1");
    expect(globalWithWindow.window.localStorage.getItem("two")).toBe("2");

    removeLocalStorageKeys(["one", "two"]);

    expect(globalWithWindow.window.localStorage.getItem("one")).toBeNull();
    expect(globalWithWindow.window.localStorage.getItem("two")).toBeNull();
  });
});
