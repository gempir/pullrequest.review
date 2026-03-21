import { Effect } from "effect";

class AppRuntimeError extends Error {
    cause?: unknown;

    constructor(message: string, options: { cause?: unknown } = {}) {
        super(message);
        this.name = "AppRuntimeError";
        this.cause = options.cause;
    }
}

function normalizeUnknownError(cause: unknown, fallbackMessage = "Operation failed"): Error {
    if (cause instanceof Error) {
        return cause;
    }
    return new AppRuntimeError(fallbackMessage, { cause });
}

export function tryEffectPromise<A>(label: string, promiseFactory: () => Promise<A>) {
    return Effect.tryPromise({
        try: promiseFactory,
        catch: (cause) => normalizeUnknownError(cause, label),
    });
}

export function tryEffectSync<A>(label: string, evaluate: () => A) {
    return Effect.try({
        try: evaluate,
        catch: (cause) => normalizeUnknownError(cause, label),
    });
}

function withEffectErrorHandling<A, E>(effect: Effect.Effect<A, E>, options?: { label?: string; logError?: boolean }) {
    const label = options?.label ?? "Effect operation failed";
    const logError = options?.logError ?? true;
    const normalized = effect.pipe(Effect.mapError((error) => normalizeUnknownError(error, label)));

    if (!logError) {
        return normalized;
    }

    return normalized.pipe(
        Effect.tapError((error) =>
            Effect.sync(() => {
                console.error(`[effect] ${label}`, error);
            }),
        ),
    );
}

export function runAppEffect<A, E>(effect: Effect.Effect<A, E>, options?: { label?: string; logError?: boolean }) {
    return Effect.runPromise(withEffectErrorHandling(effect, options));
}

export function fireAndForgetAppEffect(effect: Effect.Effect<unknown, unknown>, options?: { label?: string; logError?: boolean }) {
    void runAppEffect(effect, options).catch(() => undefined);
}
