import { describe, expect, test } from "bun:test";
import { readViewedVersionIds, writeViewedVersionIds } from "../src/components/pull-request-review/use-review-storage";

describe("review viewed version storage", () => {
    test("writes and reads viewed version ids from state collection", () => {
        const storageKey = `test:viewed:${Date.now()}`;
        const viewedVersionIds = new Set(["src/a.ts::fp-a", "src/b.ts::fp-b"]);

        writeViewedVersionIds(storageKey, viewedVersionIds);
        expect(Array.from(readViewedVersionIds(storageKey)).sort()).toEqual(["src/a.ts::fp-a", "src/b.ts::fp-b"]);
    });

    test("filters viewed version ids by known set", () => {
        const storageKey = `test:viewed-filter:${Date.now()}`;
        writeViewedVersionIds(storageKey, new Set(["src/a.ts::fp-a", "src/b.ts::fp-b"]));

        const filtered = readViewedVersionIds(storageKey, {
            knownVersionIds: new Set(["src/b.ts::fp-b"]),
        });

        expect(Array.from(filtered)).toEqual(["src/b.ts::fp-b"]);
    });

    test("keeps viewed states isolated per diff scope key", () => {
        const fullKey = `test:viewed-scope:full:${Date.now()}`;
        const rangeKey = `${fullKey}:range`;
        writeViewedVersionIds(fullKey, new Set(["src/a.ts::fp-a"]));
        writeViewedVersionIds(rangeKey, new Set(["src/a.ts::fp-b"]));

        expect(Array.from(readViewedVersionIds(fullKey))).toEqual(["src/a.ts::fp-a"]);
        expect(Array.from(readViewedVersionIds(rangeKey))).toEqual(["src/a.ts::fp-b"]);
    });
});
