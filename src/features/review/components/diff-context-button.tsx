import { AlertTriangle, Check, Loader2, UnfoldVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiffContextState } from "@/features/review/model/full-file-context";
import { cn } from "@/lib/utils";

interface DiffContextButtonProps {
    state?: DiffContextState;
    onClick: () => void;
    disabled?: boolean;
}

export function DiffContextButton({ state, onClick, disabled = false }: DiffContextButtonProps) {
    const status = state?.status ?? "idle";
    const isLoading = status === "loading";
    const isReady = status === "ready";
    const isError = status === "error";

    const label = (() => {
        if (isLoading) return "Loading...";
        if (isReady) return "Full context";
        if (isError) return "Retry load";
        return "Load context";
    })();

    const Icon = (() => {
        if (isLoading) return Loader2;
        if (isReady) return Check;
        if (isError) return AlertTriangle;
        return UnfoldVertical;
    })();

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1.5 px-2 text-[12px] font-normal text-muted-foreground hover:text-foreground"
            onClick={onClick}
            disabled={disabled || isLoading || isReady}
            title={isError && state?.status === "error" ? state.error : undefined}
        >
            <Icon className={cn("size-3.5", isLoading && "animate-spin")} />
            {label}
        </Button>
    );
}
