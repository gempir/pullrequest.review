import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$workspace/$repo/pull/$pullRequestId/changes")({
    beforeLoad: ({ location, params }) => {
        throw redirect({
            to: "/$workspace/$repo/pull/$pullRequestId",
            params,
            hash: location.hash,
            replace: true,
        });
    },
});
