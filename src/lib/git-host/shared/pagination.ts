import { Effect } from "effect";
import { runAppEffect } from "@/lib/effect/runtime";

function collectPaginatedEffect<T>(fetchPage: (page: number) => Effect.Effect<T[], Error>, pageSize = 100) {
    return Effect.gen(function* () {
        const values: T[] = [];
        let page = 1;

        while (true) {
            const current = yield* fetchPage(page);
            values.push(...current);
            if (current.length < pageSize) {
                return values;
            }
            page += 1;
        }
    });
}

export function collectPaginated<T>(fetchPage: (page: number) => Promise<T[]>, pageSize = 100) {
    return runAppEffect(
        collectPaginatedEffect(
            (page) =>
                Effect.tryPromise({
                    try: () => fetchPage(page),
                    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
                }),
            pageSize,
        ),
        {
            label: "Paginated git host request failed",
            logError: false,
        },
    );
}
