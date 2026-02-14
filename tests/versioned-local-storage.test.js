import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { __resetStorageForTests } from "../src/lib/storage/client-storage-db";
import {
    ensureStorageReady,
    makeVersionedStorageKey,
    readLocalStorageValue,
    readStorageValue,
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

beforeEach(async () => {
    await __resetStorageForTests();
    previousWindow = globalWithWindow.window;
    Object.defineProperty(globalWithWindow, "window", {
        configurable: true,
        writable: true,
        value: { localStorage: createMemoryStorage() },
    });
    await ensureStorageReady();
});

afterEach(async () => {
    await __resetStorageForTests();
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
        expect(makeVersionedStorageKey("pr_review_shortcuts", 2)).toBe("pr_review_shortcuts:v2");
    });

    test("reads current key value", () => {
        writeLocalStorageValue("settings:v2", "current");

        expect(readLocalStorageValue("settings:v2")).toBe("current");
    });

    test("returns null for missing keys", () => {
        expect(readLocalStorageValue("missing:key")).toBeNull();
    });

    test("writes and removes values defensively", () => {
        writeLocalStorageValue("one", "1");
        writeLocalStorageValue("two", "2");

        expect(readStorageValue("one")).toBe("1");
        expect(readStorageValue("two")).toBe("2");

        removeLocalStorageKeys(["one", "two"]);

        expect(readStorageValue("one")).toBeNull();
        expect(readStorageValue("two")).toBeNull();
    });
});
