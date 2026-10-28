import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$workspace/$repo/pull-requests/$pullRequestId/commits")({
    beforeLoad: ({ location, params }) => {
        throw redirect({
            to: "/$workspace/$repo/pull-requests/$pullRequestId",
            params,
            search: typeof location.search === "object" && location.search ? location.search : {},
            hash: location.hash,
            replace: true,
        });
    },
});
