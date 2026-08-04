import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HostAuthForm } from "../src/components/auth/host-auth-form";
import { PrProvider } from "../src/lib/pr-context";

function renderAuthForm(host: "bitbucket" | "github") {
    return renderToStaticMarkup(
        <PrProvider>
            <HostAuthForm host={host} mode="onboarding" />
        </PrProvider>,
    );
}

describe("host authentication choices", () => {
    test("offers both OAuth and API-token authentication for Bitbucket", () => {
        const html = renderAuthForm("bitbucket");

        expect(html).toContain("Continue with Bitbucket OAuth");
        expect(html).toContain("or use an API token");
        expect(html).toContain("Bitbucket Email");
        expect(html).toContain("Scoped API Token");
    });

    test("keeps GitHub token authentication unchanged", () => {
        const html = renderAuthForm("github");

        expect(html).toContain("GitHub Token");
        expect(html.includes("Continue with Bitbucket OAuth")).toBe(false);
    });
});
