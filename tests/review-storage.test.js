import { describe, expect, test } from "bun:test";
import {
    clearInlineDraftContent,
    listInlineDrafts,
    readInlineDraftContent,
    readViewedVersionIds,
    writeInlineDraftContent,
    writeViewedVersionIds,
} from "../src/lib/storage";

describe("review viewed version storage", () => {
    test("writes and reads viewed version ids from storage", () => {
        const storageKey = `test:viewed:${Date.now()}`;
        const viewedVersionIds = new Set(["src/a.ts::fp-a", "src/b.ts::fp-b"]);

        writeViewedVersionIds(storageKey, viewedVersionIds);
        expect(Array.from(readViewedVersionIds(storageKey)).sort()).toEqual(["src/a.ts::fp-a", "src/b.ts::fp-b"]);
    });

    test("filters viewed version ids by known set", () => {
        const storageKey = `test:viewed-filter:${Date.now()}`;
        writeViewedVersionIds(storageKey, new Set(["src/a.ts::fp-a", "src/b.ts::fp-b"]));

        const filtered = readViewedVersionIds(storageKey, new Set(["src/b.ts::fp-b"]));

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

describe("inline draft storage", () => {
    const draft = { path: "src/a.ts", line: 3, side: "additions" };

    test("stores, lists, and clears drafts per scope", () => {
        const scope = `test:drafts:${Date.now()}`;
        writeInlineDraftContent(scope, draft, "hello");
        expect(readInlineDraftContent(scope, draft)).toBe("hello");
        expect(listInlineDrafts(scope).map((entry) => entry.content)).toEqual(["hello"]);
        expect(listInlineDrafts(`${scope}:other`)).toEqual([]);
        clearInlineDraftContent(scope, draft);
        expect(readInlineDraftContent(scope, draft)).toBe("");
    });

    test("removes a draft when its content becomes blank", () => {
        const scope = `test:drafts-blank:${Date.now()}`;
        writeInlineDraftContent(scope, draft, "hello");
        writeInlineDraftContent(scope, draft, "   ");
        expect(listInlineDrafts(scope)).toEqual([]);
    });
});
