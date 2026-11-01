import { QueryClient } from "@tanstack/react-query";

export const appQueryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Host APIs are rate limited, so a failure is surfaced rather than retried.
            retry: false,
            refetchOnWindowFocus: false,
            gcTime: 10 * 60_000,
        },
    },
});
