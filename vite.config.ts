import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => ({
  resolve: {
    alias: [
      // Route top-level `shiki` imports to a smaller browser-oriented shim.
      {
        find: /^shiki$/,
        replacement: fileURLToPath(
          new URL("./src/lib/shiki-runtime.ts", import.meta.url),
        ),
      },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 3000,
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      spa: {
        enabled: true,
      },
    }),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
    tailwindcss(),
  ],
}));
