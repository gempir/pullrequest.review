/** Endpoints shared by the Cloudflare worker and the browser client. The /api prefix must match `run_worker_first` in wrangler.jsonc. */
export const BITBUCKET_OAUTH_PATHS = {
    start: "/api/auth/bitbucket/start",
    exchange: "/api/auth/bitbucket/exchange",
    refresh: "/api/auth/bitbucket/refresh",
    callback: "/oauth/callback",
} as const;
