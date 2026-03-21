import { Effect } from "effect";
import { runAppEffect } from "@/lib/effect/runtime";

function mapWithConcurrencyEffect<TInput, TOutput>(
    values: TInput[],
    concurrency: number,
    mapper: (value: TInput, index: number) => Effect.Effect<TOutput, Error>,
) {
    if (values.length === 0) {
        return Effect.succeed([] as TOutput[]);
    }

    const safeConcurrency = Math.max(1, Math.min(concurrency, values.length));
    return Effect.forEach(
        values.map((value, index) => ({ value, index })),
        ({ value, index }) => mapper(value, index),
        { concurrency: safeConcurrency },
    );
}

export function mapWithConcurrency<TInput, TOutput>(values: TInput[], concurrency: number, mapper: (value: TInput, index: number) => Promise<TOutput>) {
    return runAppEffect(
        mapWithConcurrencyEffect(values, concurrency, (value, index) =>
            Effect.tryPromise({
                try: () => mapper(value, index),
                catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
            }),
        ),
        {
            label: "Concurrent git host mapping failed",
            logError: false,
        },
    );
}
