type Route = (request: { url: URL; init: RequestInit; body: unknown }) => Response | unknown;

export type RecordedRequest = { url: URL; method: string; headers: Headers; body: unknown };

/**
 * Replaces fetch with a router keyed by "METHOD pathname" (or just pathname for GET).
 * Plain values are returned as JSON; unmatched requests answer 404. Returns the recorded requests and a restore function.
 */
export function mockFetch(routes: Record<string, Route | unknown>) {
    const originalFetch = globalThis.fetch;
    const requests: RecordedRequest[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
        const url = new URL(String(input), "https://app.test");
        const method = (init.method ?? "GET").toUpperCase();
        const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
        requests.push({ url, method, headers: new Headers(init.headers), body });
        const route = routes[`${method} ${url.pathname}`] ?? (method === "GET" ? routes[url.pathname] : undefined);
        if (route === undefined) return new Response("Not found", { status: 404 });
        const result = typeof route === "function" ? (route as Route)({ url, init, body }) : route;
        return result instanceof Response ? result : Response.json(result);
    }) as typeof fetch;
    return { requests, restore: () => (globalThis.fetch = originalFetch) };
}
