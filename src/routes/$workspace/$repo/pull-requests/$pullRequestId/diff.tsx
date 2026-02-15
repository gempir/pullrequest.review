import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$workspace/$repo/pull-requests/$pullRequestId/diff")({
    beforeLoad: ({ location, params }) => {
        throw redirect({
            to: "/$workspace/$repo/pull-requests/$pullRequestId",
            params,
            hash: location.hash,
            replace: true,
        });
    },
});
