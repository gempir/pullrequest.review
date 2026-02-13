import { registerCustomTheme } from "@pierre/diffs";
import { bundledThemes } from "shiki";

const BUILT_IN_DIFF_THEMES = new Set([
  "pierre-dark",
  "pierre-light",
  "github-dark",
  "github-light",
  "one-dark-pro",
  "nord",
]);

let registered = false;

export function registerExtendedDiffThemes() {
  if (registered) return;
  registered = true;

  for (const [themeName, loader] of Object.entries(bundledThemes)) {
    if (BUILT_IN_DIFF_THEMES.has(themeName)) continue;
    registerCustomTheme(themeName, async () => {
      const module = await loader();
      return module.default;
    });
  }
}
