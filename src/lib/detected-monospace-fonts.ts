import { useEffect, useState } from "react";
import {
    type FontFamilyValue,
    type FontOption,
    fontFamilyToCss,
    getDetectedFontName,
    MONO_FONT_FAMILY_OPTIONS,
    makeDetectedFontFamilyValue,
} from "@/lib/font-options";

type DetectedMonospaceFontOption = FontOption;

const DETECTABLE_MONO_FONT_CANDIDATES: ReadonlyArray<{ name: string }> = [
    { name: "Menlo" },
    { name: "Monaco" },
    { name: "Consolas" },
    { name: "SF Mono" },
    { name: "Ubuntu Mono" },
    { name: "Lucida Console" },
    { name: "Andale Mono" },
    { name: "Oxygen Mono" },
    { name: "Anonymous Pro" },
    { name: "Hack" },
    { name: "Inconsolata" },
    { name: "Iosevka" },
    { name: "Roboto Mono" },
    { name: "Fantasque Sans Mono" },
    { name: "PT Mono" },
    { name: "DM Mono" },
];

const builtinMonoFontNames = new Set(
    MONO_FONT_FAMILY_OPTIONS.map((option) => {
        const cssFamily = fontFamilyToCss(option.value);
        const first = cssFamily.split(",")[0]?.trim();
        if (!first) return null;
        return first.replace(/^["']|["']$/g, "").toLowerCase();
    }).filter(Boolean) as string[],
);

let cachedDetectedFonts: ReadonlyArray<DetectedMonospaceFontOption> | null = null;
let detectionPromise: Promise<ReadonlyArray<DetectedMonospaceFontOption>> | null = null;

function quoteFontName(name: string) {
    return `"${name.replace(/"/g, '\\"')}"`;
}

function buildDetectedOption(fontName: string): DetectedMonospaceFontOption {
    return {
        value: makeDetectedFontFamilyValue(fontName),
        label: `${fontName} (local)`,
        cssFamily: `${quoteFontName(fontName)}, monospace`,
    };
}

function canDetectFonts() {
    if (typeof document === "undefined") return false;
    const fontSet = document.fonts;
    return Boolean(fontSet && typeof fontSet.check === "function");
}

function checkFontAvailable(fontName: string): boolean {
    try {
        return document.fonts.check(`12px ${quoteFontName(fontName)}`);
    } catch {
        return false;
    }
}

async function detectMonospaceFonts(): Promise<ReadonlyArray<DetectedMonospaceFontOption>> {
    if (cachedDetectedFonts) return cachedDetectedFonts;
    if (!canDetectFonts()) {
        cachedDetectedFonts = [];
        return cachedDetectedFonts;
    }
    if (detectionPromise) return detectionPromise;
    detectionPromise = (async () => {
        try {
            await document.fonts.ready;
        } catch {
            // Ignore readiness failures; we'll still attempt detection.
        }
        const detected = DETECTABLE_MONO_FONT_CANDIDATES.filter((candidate) => {
            if (builtinMonoFontNames.has(candidate.name.toLowerCase())) return false;
            return checkFontAvailable(candidate.name);
        }).map((candidate) => buildDetectedOption(candidate.name));
        const sorted = detected.sort((a, b) => a.label.localeCompare(b.label));
        cachedDetectedFonts = sorted;
        detectionPromise = null;
        return sorted;
    })();
    return detectionPromise;
}

export function useDetectedMonospaceFontOptions(): ReadonlyArray<DetectedMonospaceFontOption> {
    const [options, setOptions] = useState<ReadonlyArray<DetectedMonospaceFontOption>>(() => cachedDetectedFonts ?? []);

    useEffect(() => {
        if (cachedDetectedFonts) {
            setOptions(cachedDetectedFonts);
            return;
        }
        let cancelled = false;
        detectMonospaceFonts()
            .then((result) => {
                if (cancelled) return;
                setOptions(result);
            })
            .catch(() => {
                if (cancelled) return;
                setOptions([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return options;
}

export function getDetectedFontOptionFromValue(value: FontFamilyValue): DetectedMonospaceFontOption | null {
    const fontName = getDetectedFontName(value);
    if (!fontName) return null;
    return buildDetectedOption(fontName);
}
