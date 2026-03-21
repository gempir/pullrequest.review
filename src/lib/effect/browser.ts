import { Effect } from "effect";
import { tryEffectPromise } from "@/lib/effect/runtime";

class ClipboardUnavailableError extends Error {
    constructor(message = "Clipboard is not available") {
        super(message);
        this.name = "ClipboardUnavailableError";
    }
}

export function writeClipboardTextEffect(text: string) {
    return Effect.gen(function* () {
        if (typeof navigator === "undefined" || !navigator.clipboard) {
            return yield* Effect.fail(new ClipboardUnavailableError());
        }

        yield* tryEffectPromise("Failed to write to the clipboard", () => navigator.clipboard.writeText(text));
    });
}
