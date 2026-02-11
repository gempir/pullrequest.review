import {
  createBundledHighlighter,
  createCssVariablesTheme,
  createSingletonShorthands,
  getTokenStyleObject,
  normalizeTheme,
  stringifyTokenStyle,
} from "shiki/core";
import {
  createJavaScriptRegexEngine,
  defaultJavaScriptRegexConstructor,
} from "shiki/engine/javascript";
import { bundledLanguages } from "shiki/langs";

// Keep runtime theme bundle small: only themes selectable in the UI.
export const bundledThemes = {
  "github-dark": () => import("@shikijs/themes/github-dark"),
  "github-light": () => import("@shikijs/themes/github-light"),
  nord: () => import("@shikijs/themes/nord"),
  "one-dark-pro": () => import("@shikijs/themes/one-dark-pro"),
} as const;

export {
  bundledLanguages,
  createCssVariablesTheme,
  createJavaScriptRegexEngine,
  defaultJavaScriptRegexConstructor,
  getTokenStyleObject,
  normalizeTheme,
  stringifyTokenStyle,
};

export const createHighlighter = createBundledHighlighter({
  langs: bundledLanguages,
  themes: bundledThemes,
  engine: createJavaScriptRegexEngine,
});

export const { codeToHtml } = createSingletonShorthands(createHighlighter);
