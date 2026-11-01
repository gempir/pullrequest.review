import { ArrowRight, Search } from "lucide-react";
import type { RefObject } from "react";
import { type PullRequestTarget, parsePullRequestUrl } from "@/features/landing/model/landing-model";
import { cn } from "@/lib/utils";

/** One field for everything: type to filter, or paste a pull request URL to open it. */
export function PullRequestUrlField({
    value,
    onChange,
    onOpenTarget,
    placeholder,
    inputRef,
    large,
    autoFocus,
}: {
    value: string;
    onChange: (value: string) => void;
    onOpenTarget: (target: PullRequestTarget) => void;
    placeholder: string;
    inputRef?: RefObject<HTMLInputElement | null>;
    large?: boolean;
    autoFocus?: boolean;
}) {
    const target = parsePullRequestUrl(value);
    return (
        <form
            className={cn(
                "glass relative flex w-full items-center gap-2.5 rounded-full px-4 focus-within:ring-3 focus-within:ring-ring/30",
                large ? "h-14" : "h-11",
            )}
            onSubmit={(event) => {
                event.preventDefault();
                if (target) onOpenTarget(target);
            }}
        >
            <Search className={cn("shrink-0 text-faint-foreground", large ? "size-5" : "size-4")} aria-hidden="true" />
            <input
                ref={inputRef}
                // biome-ignore lint/a11y/noAutofocus: the field is the only task on this screen
                autoFocus={autoFocus}
                className={cn("h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint-foreground", large ? "text-[17px]" : "text-[14px]")}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
            />
            {target ? (
                <button
                    type="submit"
                    className="pressable -mr-2 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent-solid px-3.5 text-[13px] font-medium text-accent-foreground hover:bg-accent-solid-hover"
                >
                    Open #{target.pullRequestId}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                </button>
            ) : null}
        </form>
    );
}
