import { describe, expect, test } from "bun:test";
import { collectPaginated } from "@/lib/git-host/shared/pagination";

describe("collectPaginated", () => {
    test("stops after maxItems across pages", async () => {
        const pages = [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
        ];
        const values = await collectPaginated(async (page) => pages[page - 1] ?? [], 3, 5);
        expect(values).toEqual([1, 2, 3, 4, 5]);
    });
});
