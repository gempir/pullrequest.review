import { AlertTriangle, Check, Loader2, UnfoldVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DiffContextState = { status: "idle" } | { status: "loading" } | { status: "ready" } | { status: "error"; error: string };

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
        if (isLoading) return "Loading…";
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
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[12px] gap-1.5"
            onClick={onClick}
            disabled={disabled || isLoading || isReady}
            title={isError && state?.status === "error" ? state.error : undefined}
        >
            <Icon className={cn("size-3.5", isLoading && "animate-spin")} />
            {label}
        </Button>
    );
}
