export const DIFF_THEMES = [
  "pierre-dark",
  "pierre-light",
  "github-dark",
  "github-light",
  "one-dark-pro",
  "nord",
] as const;

export type DiffTheme = (typeof DIFF_THEMES)[number];

export const DEFAULT_DIFF_THEME: DiffTheme = "github-dark";
