import { describe, expect, test } from "bun:test";
import { commentTimestampSource, describeCommentTimestamp } from "@/lib/timestamp";

const NOW = new Date("2026-11-01T12:00:00Z").getTime();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function ago(ms: number) {
    return new Date(NOW - ms).toISOString();
}

describe("describeCommentTimestamp", () => {
    test("under an hour renders minutes ago", () => {
        expect(describeCommentTimestamp(ago(45 * MINUTE), { now: NOW }).label).toBe("45 minutes ago");
        expect(describeCommentTimestamp(ago(1 * MINUTE), { now: NOW }).label).toBe("1 minute ago");
    });

    test("between one and twelve hours renders only the local time", () => {
        const value = ago(3 * HOUR);
        const result = describeCommentTimestamp(value, { now: NOW });
        expect(result.label).toBe(new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
        expect(result.label).not.toContain("ago");
        expect(result.isRelative).toBe(true);
    });

    test("over twelve hours renders the full local date and time, with an exact tooltip", () => {
        const value = ago(13 * HOUR);
        const result = describeCommentTimestamp(value, { now: NOW });
        const date = new Date(value);
        expect(result.label).toBe(date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));
        expect(result.absoluteLabel).toBe(
            date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }),
        );
        expect(result.isRelative).toBe(false);
    });

    test("exact tooltip label includes seconds for abbreviated values", () => {
        const value = ago(5 * MINUTE);
        const result = describeCommentTimestamp(value, { now: NOW });
        expect(result.absoluteLabel).toBe(
            new Date(value).toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
            }),
        );
    });

    test("missing or invalid values use the unknown label", () => {
        expect(describeCommentTimestamp(undefined, { now: NOW }).label).toBe("Unknown");
        expect(describeCommentTimestamp("", { unknownLabel: "" }).label).toBe("");
    });
});

describe("commentTimestampSource", () => {
    test("prefers updatedAt and falls back to createdAt", () => {
        expect(commentTimestampSource({ createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z" })).toBe("2026-01-02T00:00:00Z");
        expect(commentTimestampSource({ createdAt: "2026-01-01T00:00:00Z" })).toBe("2026-01-01T00:00:00Z");
    });
});
