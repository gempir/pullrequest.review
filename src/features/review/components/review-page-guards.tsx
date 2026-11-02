import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export function ReviewPageErrorState({
    message,
    showRateLimitHelp,
    authPromptSlot,
}: {
    message: string;
    showRateLimitHelp: boolean;
    authPromptSlot?: ReactNode;
}) {
    return (
        <div className="flex h-full items-center justify-center overflow-auto p-8">
            <div className="glass max-w-lg rounded-2xl p-6">
                <div className="mb-2 flex items-center gap-2 text-destructive">
                    <AlertCircle className="size-5" />
                    <h1 className="section-title text-[17px]">Could not load this pull request</h1>
                </div>
                <p className="text-[13px] text-muted-foreground">{message}</p>
                {showRateLimitHelp ? (
                    <p className="mt-2 text-[13px] text-muted-foreground">
                        GitHub is rate limiting requests because there are too many unauthenticated requests from your network IP. Connect a GitHub token to
                        continue and retry.
                    </p>
                ) : null}
                {authPromptSlot ? <div className="mt-4">{authPromptSlot}</div> : null}
            </div>
        </div>
    );
}

export function ReviewPageAuthRequiredState({ hostLabel, authPromptSlot }: { hostLabel: string; authPromptSlot?: ReactNode }) {
    return (
        <div className="flex h-full items-center justify-center overflow-auto p-8">
            <div className="glass max-w-lg space-y-3 rounded-2xl p-6">
                <h1 className="section-title text-[17px]">Connect {hostLabel}</h1>
                <p className="text-[13px] text-muted-foreground">Connect {hostLabel} to load this pull request.</p>
                {authPromptSlot}
            </div>
        </div>
    );
}
