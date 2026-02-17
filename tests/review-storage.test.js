import { beforeEach, describe, expect, test } from "bun:test";
import {
    buildLatestVersionIdByPath,
    mergeCurrentFileVersionsIntoHistory,
    readFileVersionHistory,
    readViewedVersionIds,
    writeFileVersionHistory,
    writeViewedVersionIds,
} from "../src/components/pull-request-review/use-review-storage";
import { __resetStorageForTests } from "../src/lib/storage/client-storage-db";
import { readStorageValue, writeLocalStorageValue } from "../src/lib/storage/versioned-local-storage";

const STORAGE_KEY = "test:viewed";

beforeEach(async () => {
    await __resetStorageForTests();
});

describe("review versioned storage", () => {
    test("reads legacy fingerprint payloads into version ids", () => {
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

        const knownVersionIds = new Set(["src/a.ts::fp-a", "src/b.ts::fp-b", "src/c.ts::fp-c"]);
        const viewed = readViewedVersionIds(STORAGE_KEY, {
            fileDiffFingerprints: new Map([
                ["src/a.ts", "fp-a"],
                ["src/b.ts", "fp-b"],
            ]),
            knownVersionIds,
        });

        expect(Array.from(viewed).sort()).toEqual(["src/a.ts::fp-a", "src/b.ts::fp-b"]);
    });

    test("writes and reads viewed version payload", () => {
        const viewedVersionIds = new Set(["src/a.ts::fp-a", "src/b.ts::fp-b"]);

        writeViewedVersionIds(STORAGE_KEY, viewedVersionIds);

        const raw = readStorageValue(`${STORAGE_KEY}:viewed_versions`);
        expect(raw).not.toBeNull();
        expect(JSON.parse(String(raw))).toEqual({
            version: 1,
            viewedVersionIds: ["src/a.ts::fp-a", "src/b.ts::fp-b"],
        });

        expect(Array.from(readViewedVersionIds(STORAGE_KEY)).sort()).toEqual(["src/a.ts::fp-a", "src/b.ts::fp-b"]);
    });

    test("merges current file versions and keeps reverted fingerprint as existing version", () => {
        const first = mergeCurrentFileVersionsIntoHistory(
            {},
            new Map([
                [
                    "src/a.ts",
                    {
                        fingerprint: "fp-a1",
                        snapshot: { type: "modified", name: "src/a.ts", hunks: [] },
                    },
                ],
            ]),
        );

        const second = mergeCurrentFileVersionsIntoHistory(
            first,
            new Map([
                [
                    "src/a.ts",
                    {
                        fingerprint: "fp-a2",
                        snapshot: { type: "modified", name: "src/a.ts", hunks: [] },
                    },
                ],
            ]),
        );

        const third = mergeCurrentFileVersionsIntoHistory(
            second,
            new Map([
                [
                    "src/a.ts",
                    {
                        fingerprint: "fp-a1",
                        snapshot: { type: "modified", name: "src/a.ts", hunks: [] },
                    },
                ],
            ]),
        );

        const history = third["src/a.ts"];
        expect(history.order.length).toBe(2);
        expect(new Set(history.order)).toEqual(new Set(["src/a.ts::fp-a1", "src/a.ts::fp-a2"]));
        expect(history.order[0]).toBe("src/a.ts::fp-a1");
    });

    test("writes and reads file history payload", () => {
        const history = mergeCurrentFileVersionsIntoHistory(
            {},
            new Map([
                [
                    "src/a.ts",
                    {
                        fingerprint: "fp-a1",
                        snapshot: { type: "modified", name: "src/a.ts", hunks: [] },
                    },
                ],
            ]),
        );

        writeFileVersionHistory(STORAGE_KEY, history);

        const raw = readStorageValue(`${STORAGE_KEY}:history`);
        expect(raw).not.toBeNull();
        expect(JSON.parse(String(raw)).version).toBe(1);

        const loaded = readFileVersionHistory(STORAGE_KEY);
        expect(Object.keys(loaded)).toEqual(["src/a.ts"]);
        expect(buildLatestVersionIdByPath(loaded).get("src/a.ts")).toBe("src/a.ts::fp-a1");
    });
});
