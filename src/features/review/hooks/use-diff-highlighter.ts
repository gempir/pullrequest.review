import type { FileDiffMetadata } from "@pierre/diffs";
import { getFiletypeFromFileName } from "@pierre/diffs";
import { useWorkerPool } from "@pierre/diffs/react";
import { useEffect, useMemo, useState } from "react";

/** Preloads syntax grammars for the diff's languages; reports a plain-text fallback when the highlighter worker is unavailable. */
export function useDiffPlainTextFallback(fileDiffs: FileDiffMetadata[]) {
    const workerPool = useWorkerPool();
    const [failed, setFailed] = useState(false);
    const languagesKey = useMemo(() => {
        const languages = new Set<string>(["text", "javascript"]);
        for (const fileDiff of fileDiffs) {
            if (fileDiff.lang) languages.add(fileDiff.lang);
            languages.add(getFiletypeFromFileName(fileDiff.name));
            if (fileDiff.prevName) languages.add(getFiletypeFromFileName(fileDiff.prevName));
        }
        return Array.from(languages).toSorted().join(",");
    }, [fileDiffs]);
    const hasFiles = fileDiffs.length > 0;
    const poolWorking = Boolean(workerPool?.isWorkingPool());

    useEffect(() => {
        if (!hasFiles || !workerPool || !poolWorking) return;
        let cancelled = false;
        setFailed(false);
        void workerPool.initialize(languagesKey.split(",") as Parameters<typeof workerPool.initialize>[0]).catch(() => {
            if (!cancelled) setFailed(true);
        });
        return () => {
            cancelled = true;
        };
    }, [hasFiles, languagesKey, poolWorking, workerPool]);

    return hasFiles && (!poolWorking || failed);
}
