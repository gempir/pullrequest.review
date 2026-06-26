import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(() => ({
    server: {
        host: "127.0.0.1",
        port: 3000,
    },
    resolve: {
        tsconfigPaths: true,
    },
    plugins: [
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
