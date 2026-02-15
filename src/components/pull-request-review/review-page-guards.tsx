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
        <div className="flex items-center justify-center h-full p-8">
            <div className="border border-destructive bg-destructive/10 p-6 max-w-lg">
                <div className="flex items-center gap-2 text-destructive mb-2">
                    <AlertCircle className="size-5" />
                    <span className="text-[13px] font-medium">[ERROR]</span>
                </div>
                <p className="text-destructive text-[13px]">{message}</p>
                {showRateLimitHelp ? (
                    <p className="mt-2 text-[12px] text-destructive">
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
        <div className="flex items-center justify-center h-full p-8">
            <div className="border border-border bg-card p-6 max-w-lg space-y-3">
                <div className="text-[13px] font-medium">Authentication required</div>
                <p className="text-[12px] text-muted-foreground">Connect {hostLabel} to load this pull request.</p>
                {authPromptSlot}
            </div>
        </div>
    );
}
