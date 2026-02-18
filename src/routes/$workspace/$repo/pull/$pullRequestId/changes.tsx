import { createFileRoute, redirect } from "@tanstack/react-router";

const DEFAULT_REVIEW_SCOPE_SEARCH = { scope: "full", includeMerge: "0" } as const;

export const Route = createFileRoute("/$workspace/$repo/pull/$pullRequestId/changes")({
    beforeLoad: ({ location, params }) => {
        throw redirect({
            to: "/$workspace/$repo/pull/$pullRequestId",
            params,
            search:
                typeof location.search === "object" && location.search ? { ...DEFAULT_REVIEW_SCOPE_SEARCH, ...location.search } : DEFAULT_REVIEW_SCOPE_SEARCH,
            hash: location.hash,
            replace: true,
        });
    },
});
