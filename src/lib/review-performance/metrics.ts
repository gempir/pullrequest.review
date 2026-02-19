export type ReviewPerfSnapshot = {
    lastCriticalLoadMs: number | null;
    lastDeferredLoadMs: number | null;
    longTaskCount: number;
    workerQueueDepth: number;
};

const snapshot: ReviewPerfSnapshot = {
    lastCriticalLoadMs: null,
    lastDeferredLoadMs: null,
    longTaskCount: 0,
    workerQueueDepth: 0,
};

const markCounts = new Map<string, number>();
let longTaskObserverStarted = false;

function nextMarkName(name: string) {
    const count = (markCounts.get(name) ?? 0) + 1;
    markCounts.set(name, count);
    return `${name}#${count}`;
}

export function markReviewPerf(name: string) {
    if (typeof performance === "undefined") return "";
    const markName = nextMarkName(name);
    performance.mark(markName);
    return markName;
}

export function measureReviewPerf(name: string, startMark: string, endMark?: string) {
    if (typeof performance === "undefined" || !startMark) return null;
    const end = endMark && endMark.length > 0 ? endMark : undefined;
    try {
        performance.measure(name, startMark, end);
        const entries = performance.getEntriesByName(name, "measure");
        const latest = entries[entries.length - 1];
        return latest ? latest.duration : null;
    } catch {
        return null;
    }
}

export function setCriticalLoadDuration(durationMs: number) {
    snapshot.lastCriticalLoadMs = Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : null;
}

export function setDeferredLoadDuration(durationMs: number) {
    snapshot.lastDeferredLoadMs = Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : null;
}

export function setWorkerQueueDepth(depth: number) {
    if (!Number.isFinite(depth)) return;
    snapshot.workerQueueDepth = Math.max(0, Math.round(depth));
}

function incrementLongTaskCount() {
    snapshot.longTaskCount += 1;
}

export function getReviewPerfSnapshot(): ReviewPerfSnapshot {
    return { ...snapshot };
}

export function ensureLongTaskObserver() {
    if (longTaskObserverStarted || typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
        return;
    }

    const supportedEntryTypes = PerformanceObserver.supportedEntryTypes;
    if (!Array.isArray(supportedEntryTypes) || !supportedEntryTypes.includes("longtask")) {
        return;
    }

    const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (!entries.length) return;
        for (const entry of entries) {
            if (entry.entryType !== "longtask") continue;
            incrementLongTaskCount();
        }
    });

    try {
        observer.observe({ type: "longtask", buffered: true });
        longTaskObserverStarted = true;
    } catch {
        // Ignore unsupported browsers.
    }
}
