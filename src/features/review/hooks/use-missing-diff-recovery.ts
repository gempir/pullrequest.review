import { useEffect, useRef } from "react";
import { hashString } from "@/features/review/model/review-file-fingerprint";

const MAX_RECOVERIES = 2;

/** Hosts occasionally answer with a diffstat but an empty diff; refetching usually fills it in. */
export function useMissingDiffRecovery({
    contextKey,
    diff,
    diffstatCount,
    selectablePathCount,
    enabled,
    refetch,
}: {
    contextKey: string;
    diff: string | undefined;
    diffstatCount: number;
    selectablePathCount: number;
    enabled: boolean;
    refetch: () => Promise<unknown>;
}) {
    const recoveryRef = useRef({ contextKey: "", attempts: 0, signature: "" });
    useEffect(() => {
        if (!enabled || diff === undefined || diffstatCount === 0) return;
        if (recoveryRef.current.contextKey !== contextKey) recoveryRef.current = { contextKey, attempts: 0, signature: "" };
        const hasDiffText = diff.trim().length > 0;
        if (hasDiffText && selectablePathCount > 0) return;
        const signature = `${diffstatCount}:${selectablePathCount}:${hasDiffText ? hashString(diff) : "none"}`;
        if (recoveryRef.current.attempts >= MAX_RECOVERIES || recoveryRef.current.signature === signature) return;
        recoveryRef.current = { contextKey, attempts: recoveryRef.current.attempts + 1, signature };
        void refetch();
    }, [contextKey, diff, diffstatCount, enabled, refetch, selectablePathCount]);
}
