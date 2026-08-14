import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppearanceTab } from "../src/features/settings/components/appearance-tab";
import { AppearanceProvider } from "../src/lib/appearance-context";

const SETTINGS_CONTROLS = [
    { id: "appearance-app-theme", label: "App Theme", element: "button" },
    { id: "appearance-sans-font", label: "Sans Font", element: "button" },
    { id: "appearance-sans-font-size", label: "Sans Font Size", element: "input" },
    { id: "appearance-sans-line-height", label: "Sans Line Height", element: "input" },
    { id: "appearance-monospace-font", label: "Monospaced Font", element: "button" },
    { id: "appearance-monospace-font-size", label: "Monospaced Font Size", element: "input" },
    { id: "appearance-monospace-line-height", label: "Monospaced Line Height", element: "input" },
] as const;

describe("appearance settings accessibility", () => {
    test("associates every visible settings label with its control", () => {
        const html = renderToStaticMarkup(
            <AppearanceProvider>
                <AppearanceTab />
            </AppearanceProvider>,
        );

        for (const { id, label, element } of SETTINGS_CONTROLS) {
            expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>${label}</label>`));
            expect(html).toMatch(new RegExp(`<${element}[^>]*id="${id}"`));
        }
    });
});
