import { beforeEach, describe, expect, test } from "bun:test";
import { readViewedVersionIds, writeViewedVersionIds } from "../src/components/pull-request-review/use-review-storage";
import { __resetStorageForTests } from "../src/lib/storage/client-storage-db";
import { readStorageValue, writeLocalStorageValue } from "../src/lib/storage/versioned-local-storage";

const STORAGE_KEY = "test:viewed";

beforeEach(async () => {
    await __resetStorageForTests();
});

describe("review viewed version storage", () => {
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

        const viewed = readViewedVersionIds(STORAGE_KEY, {
            fileDiffFingerprints: new Map([
                ["src/a.ts", "fp-a"],
                ["src/b.ts", "fp-b"],
            ]),
            knownVersionIds: new Set(["src/a.ts::fp-a", "src/b.ts::fp-b"]),
        });

        expect(Array.from(viewed).sort()).toEqual(["src/a.ts::fp-a", "src/b.ts::fp-b"]);
    });

    test("writes and reads version payload", () => {
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
});
