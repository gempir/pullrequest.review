import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { bitbucketOAuthDevPlugin } from "./vite/bitbucket-oauth-dev-plugin";

function loadWranglerDevVars() {
    try {
        return parseEnv(readFileSync(resolve(process.cwd(), ".dev.vars"), "utf8"));
    } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return {};
        throw error;
    }
}

export default defineConfig(({ command, mode }) => {
    const env = {
        ...(command === "serve" ? loadWranglerDevVars() : {}),
        ...loadEnv(mode, process.cwd(), ""),
    };

    return {
        server: {
            host: "127.0.0.1",
            port: 3000,
        },
        resolve: {
            tsconfigPaths: true,
        },
        plugins: [
            bitbucketOAuthDevPlugin({
                BITBUCKET_OAUTH_CLIENT_ID: env.BITBUCKET_OAUTH_CLIENT_ID,
                BITBUCKET_OAUTH_CLIENT_SECRET: env.BITBUCKET_OAUTH_CLIENT_SECRET,
            }),
            tanstackStart({
                spa: {
                    enabled: true,
                },
            }),
            // react's vite plugin must come after start's vite plugin
            viteReact(),
            tailwindcss(),
        ],
    };
});
