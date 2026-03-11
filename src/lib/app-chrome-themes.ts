export type AppChromeThemeId = "system" | "graphite" | "paper";

type AppChromeThemeDefinition = {
    id: AppChromeThemeId;
    label: string;
    description: string;
};

export const APP_CHROME_THEMES: readonly AppChromeThemeDefinition[] = [
    {
        id: "system",
        label: "System",
        description: "Match the OS/browser light or dark preference.",
    },
    {
        id: "graphite",
        label: "Midnight",
        description: "Linear-like dark chrome with neutral surfaces and restrained indigo accents.",
    },
    {
        id: "paper",
        label: "Paper",
        description: "Soft light chrome with the same hierarchy and spacing model.",
    },
] as const;
