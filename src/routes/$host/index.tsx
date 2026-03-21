import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/features/landing/components/landing-page";

export const Route = createFileRoute("/$host/")({
    component: HostLandingPage,
});

function HostLandingPage() {
    const { host } = Route.useParams();

    if (host !== "bitbucket" && host !== "github") {
        return <LandingPage />;
    }

    return <LandingPage initialHost={host} initialDiffPanel="repositories" />;
}
