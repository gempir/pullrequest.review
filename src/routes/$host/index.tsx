import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/features/landing/components/landing-page";
import { isGitHost } from "@/lib/git-host/types";

export const Route = createFileRoute("/$host/")({
    component: HostLandingPage,
});

function HostLandingPage() {
    const { host } = Route.useParams();

    return <LandingPage initialHost={isGitHost(host) ? host : undefined} />;
}
