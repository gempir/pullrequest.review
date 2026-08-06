import { describe, expect, test } from "bun:test";
import { shouldShowRepoPullRequestLoading } from "../src/features/landing/model/landing-model";

const initialLoadingState = {
    hasSelectedRepositories: true,
    recordCount: 0,
    isLiveQueryLoading: true,
    isFetching: true,
    dataUpdatedAt: 0,
    error: undefined,
};

describe("pull request list loading state", () => {
    test("shows loading while the initial request is unresolved", () => {
        expect(shouldShowRepoPullRequestLoading(initialLoadingState)).toBe(true);
    });

    test("stops loading after a successful empty response", () => {
        expect(
            shouldShowRepoPullRequestLoading({
                ...initialLoadingState,
                isFetching: false,
                dataUpdatedAt: Date.now(),
            }),
        ).toBe(false);
    });

    test("allows an initial request error to render", () => {
        expect(
            shouldShowRepoPullRequestLoading({
                ...initialLoadingState,
                isFetching: false,
                error: new Error("Failed to load pull requests"),
            }),
        ).toBe(false);
    });
});
