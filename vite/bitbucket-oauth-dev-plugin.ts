import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { type BitbucketOAuthEnv, handleBitbucketOAuthRequest } from "../src/worker";

const MAX_DEV_REQUEST_BODY_BYTES = 64 * 1024;

function requestHeaders(request: IncomingMessage) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) {
            for (const entry of value) headers.append(name, entry);
        } else if (typeof value === "string") {
            headers.set(name, value);
        }
    }
    return headers;
}

async function requestBody(request: IncomingMessage) {
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of request) {
        const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk);
        size += bytes.byteLength;
        if (size > MAX_DEV_REQUEST_BODY_BYTES) throw new Error("OAuth development request body is too large");
        chunks.push(bytes);
    }

    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return body;
}

async function toFetchRequest(request: IncomingMessage) {
    const host = request.headers.host ?? "127.0.0.1:3000";
    const url = new URL(request.url ?? "/", `http://${host}`);
    const method = request.method ?? "GET";
    const body = method === "GET" || method === "HEAD" ? undefined : await requestBody(request);
    return new Request(url, {
        method,
        headers: requestHeaders(request),
        body,
    });
}

async function writeNodeResponse(response: Response, target: ServerResponse) {
    target.statusCode = response.status;
    response.headers.forEach((value, name) => {
        target.setHeader(name, value);
    });
    target.end(new Uint8Array(await response.arrayBuffer()));
}

export function bitbucketOAuthDevPlugin(env: BitbucketOAuthEnv): Plugin {
    return {
        name: "pullrequestdotreview-bitbucket-oauth-dev",
        apply: "serve",
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                if (!request.url?.startsWith("/api/auth/bitbucket/")) {
                    next();
                    return;
                }

                void toFetchRequest(request)
                    .then((fetchRequest) => handleBitbucketOAuthRequest(fetchRequest, env))
                    .then((oauthResponse) => {
                        if (!oauthResponse) {
                            next();
                            return;
                        }
                        return writeNodeResponse(oauthResponse, response);
                    })
                    .catch((error) => next(error instanceof Error ? error : new Error("OAuth development middleware failed")));
            });
        },
    };
}
