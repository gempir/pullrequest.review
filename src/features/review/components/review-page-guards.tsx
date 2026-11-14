import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export function ReviewPageErrorState({ message, rateLimitHelp, authPromptSlot }: { message: string; rateLimitHelp?: string; authPromptSlot?: ReactNode }) {
    return (
        <div className="flex items-center justify-center h-full p-8">
            <div role="alert" className="max-w-lg rounded-md border border-destructive/40 bg-destructive/10 p-5">
                <div className="mb-2 flex items-center gap-2 text-destructive">
                    <AlertCircle className="size-4" />
                    <span className="text-[13px] font-semibold">Could not load this pull request</span>
                </div>
                <p className="text-[13px] text-foreground">{message}</p>
                {rateLimitHelp ? <p className="mt-2 text-[12px] text-muted-foreground">{rateLimitHelp}</p> : null}
                {authPromptSlot ? <div className="mt-4">{authPromptSlot}</div> : null}
            </div>
        </div>
    );
}

export function ReviewPageAuthRequiredState({ hostLabel, authPromptSlot }: { hostLabel: string; authPromptSlot?: ReactNode }) {
    return (
        <div className="flex items-center justify-center h-full p-8">
            <div className="max-w-lg space-y-3 rounded-md border border-border bg-card p-5">
                <div className="text-[13px] font-semibold">Authentication required</div>
                <p className="text-[12px] text-muted-foreground">Connect {hostLabel} to load this pull request.</p>
                {authPromptSlot}
            </div>
        </div>
    );
}
