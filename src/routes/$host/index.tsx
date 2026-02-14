import { createFileRoute } from "@tanstack/react-router";
import type { GitHost } from "@/lib/git-host/types";
import { LandingPage } from "../index";

export const Route = createFileRoute("/$host/")({
  component: HostRoute,
});

function HostRoute() {
  const { host } = Route.useParams();

  if (host !== "bitbucket" && host !== "github") {
    return null;
  }

  return (
    <LandingPage
      initialHost={host as GitHost}
      initialDiffPanel="repositories"
    />
  );
}
