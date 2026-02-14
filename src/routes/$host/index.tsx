import { createFileRoute } from "@tanstack/react-router";
import { isGitHost } from "@/lib/git-host/host";
import { LandingPage } from "../index";

export const Route = createFileRoute("/$host/")({
  component: HostRoute,
});

function HostRoute() {
  const { host } = Route.useParams();

  if (!isGitHost(host)) {
    return null;
  }

  return (
    <LandingPage
      initialHost={host}
      initialDiffPanel="repositories"
    />
  );
}
