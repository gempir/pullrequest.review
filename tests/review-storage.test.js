import { beforeEach, describe, expect, test } from "bun:test";
import { readViewedFiles, writeViewedFiles } from "../src/components/pull-request-review/use-review-storage";
import { __resetStorageForTests } from "../src/lib/storage/client-storage-db";
import { readStorageValue, writeLocalStorageValue } from "../src/lib/storage/versioned-local-storage";

const STORAGE_KEY = "test:viewed";

beforeEach(async () => {
    await __resetStorageForTests();
});

describe("review viewed-files storage", () => {
    test("reads legacy array payloads", () => {
        writeLocalStorageValue(STORAGE_KEY, JSON.stringify(["src/a.ts", "src/b.ts"]));

        expect(Array.from(readViewedFiles(STORAGE_KEY))).toEqual(["src/a.ts", "src/b.ts"]);
    });

    test("reads fingerprint payloads and filters mismatches", () => {
        writeLocalStorageValue(
            STORAGE_KEY,
            JSON.stringify({
                version: 3,
                entries: {
                    "src/a.ts": "fp-a",
                    "src/b.ts": "fp-b",
                },
            }),
        );
        const fingerprints = new Map([
            ["src/a.ts", "fp-a"],
            ["src/b.ts", "diff-b"],
        ]);

        expect(Array.from(readViewedFiles(STORAGE_KEY, fingerprints))).toEqual(["src/a.ts"]);
    });

    test("writes fingerprint payloads when metadata is available", () => {
        const fingerprints = new Map([
            ["src/a.ts", "fp-a"],
            ["src/b.ts", "fp-b"],
        ]);

        writeViewedFiles(STORAGE_KEY, new Set(["src/a.ts", "src/b.ts", "src/c.ts"]), fingerprints);

        const raw = readStorageValue(STORAGE_KEY);
        expect(raw).not.toBeNull();
        expect(JSON.parse(String(raw))).toEqual({
            version: 3,
            entries: {
                "src/a.ts": "fp-a",
                "src/b.ts": "fp-b",
            },
        });
    });

    test("removes storage when no fingerprints match viewed entries", () => {
        const fingerprints = new Map([
            ["src/a.ts", "fp-a"],
            ["src/b.ts", "fp-b"],
        ]);

        writeViewedFiles(STORAGE_KEY, new Set(["missing.ts"]), fingerprints);

        expect(readStorageValue(STORAGE_KEY)).toBeNull();
    });

    test("falls back to array payloads when fingerprints are unavailable", () => {
        writeViewedFiles(STORAGE_KEY, new Set(["src/a.ts", "src/b.ts"]));

        expect(JSON.parse(String(readStorageValue(STORAGE_KEY)))).toEqual(["src/a.ts", "src/b.ts"]);
    });
});
