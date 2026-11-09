import { useState } from "react";

/** Merge dialog form state. Without a strategy (free-text hosts left blank) the host applies its own default. */
export function useMergeDialog(mergeStrategies: string[] | undefined) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
    const [closeSourceBranch, setCloseSourceBranch] = useState(true);
    return {
        open,
        setOpen,
        message,
        setMessage,
        mergeStrategy: selectedStrategy ?? mergeStrategies?.[0] ?? "",
        setMergeStrategy: setSelectedStrategy,
        closeSourceBranch,
        setCloseSourceBranch,
    };
}
