import { useCallback, useEffect, useState } from "react";
import { Timestamp } from "@/components/timestamp";
import { Button } from "@/components/ui/button";
import { clearExpiredDataNow, type DataCollectionsDebugSnapshot, getDataCollectionsDebugSnapshot, type StorageTier } from "@/lib/data/query-collections";
import { getReviewPerfSnapshot, type ReviewPerfSnapshot } from "@/lib/review-performance/metrics";

function formatBytes(bytes: number | null) {
    if (bytes === null || !Number.isFinite(bytes)) return "n/a";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function StorageTab() {
    const [state, setState] = useState<{
        snapshot: DataCollectionsDebugSnapshot | null;
        perfSnapshot: ReviewPerfSnapshot | null;
        loading: boolean;
        busyAction: "refresh" | "clear-expired" | "export" | null;
        statusMessage: string | null;
    }>({
        snapshot: null,
        perfSnapshot: null,
        loading: true,
        busyAction: null,
        statusMessage: null,
    });

    const refreshSnapshots = useCallback(async () => {
        setState((prev) => ({ ...prev, busyAction: "refresh" }));
        try {
            const snapshot = await getDataCollectionsDebugSnapshot();
            const perfSnapshot = getReviewPerfSnapshot();
            setState((prev) => ({ ...prev, snapshot, perfSnapshot }));
        } finally {
            setState((prev) => ({ ...prev, busyAction: null, loading: false }));
        }
    }, []);

    useEffect(() => {
        void refreshSnapshots();
    }, [refreshSnapshots]);

    const runClearExpired = useCallback(async () => {
        if (!window.confirm("Clear expired storage entries now?")) return;
        setState((prev) => ({ ...prev, busyAction: "clear-expired", statusMessage: null }));
        const startedAt = Date.now();
        try {
            const result = await clearExpiredDataNow();
            await refreshSnapshots();
            setState((prev) => ({
                ...prev,
                statusMessage: `Cleared expired data: ${result.removed} records removed in ${Date.now() - startedAt}ms (app ${result.appRemoved}).`,
            }));
        } finally {
            setState((prev) => ({ ...prev, busyAction: null }));
        }
    }, [refreshSnapshots]);

    const runExportDiagnostics = useCallback(async () => {
        setState((prev) => ({ ...prev, busyAction: "export", statusMessage: null }));
        try {
            const snapshot = await getDataCollectionsDebugSnapshot();
            const perfSnapshot = getReviewPerfSnapshot();
            const payload = JSON.stringify({ generatedAt: new Date().toISOString(), storage: snapshot, reviewPerformance: perfSnapshot }, null, 2);

            let copied = false;
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                try {
                    await navigator.clipboard.writeText(payload);
                    copied = true;
                } catch {
                    copied = false;
                }
            }

            if (!copied && typeof window !== "undefined") {
                const blob = new Blob([payload], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `storage-diagnostics-${Date.now()}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                setState((prev) => ({ ...prev, statusMessage: "Diagnostics exported as JSON file." }));
            } else {
                setState((prev) => ({ ...prev, statusMessage: "Diagnostics copied to clipboard as JSON." }));
            }
        } finally {
            setState((prev) => ({ ...prev, busyAction: null }));
        }
    }, []);

    if (state.loading && !state.snapshot) {
        return <div className="text-[12px] text-muted-foreground">Loading storage diagnostics...</div>;
    }

    const tierOrder: StorageTier[] = ["state", "permanent"];

    return (
        <div className="max-w-4xl space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] text-muted-foreground">Storage diagnostics and safe maintenance actions.</div>
                <Button variant="outline" size="sm" onClick={() => void refreshSnapshots()} disabled={state.busyAction !== null}>
                    Refresh
                </Button>
            </div>

            {state.statusMessage ? (
                <div className="rounded-md border border-border-muted bg-surface-1 px-2 py-1.5 text-[11px]">{state.statusMessage}</div>
            ) : null}

            {state.snapshot ? (
                <>
                    <section className="space-y-2">
                        <h3 className="text-[12px] font-medium">Storage Health</h3>
                        <div className="grid grid-cols-1 gap-2 text-[12px] md:grid-cols-3">
                            <div className="p-2">
                                <div>Collections backend: {state.snapshot.backendMode}</div>
                                <div>Persistence degraded: {state.snapshot.persistenceDegraded ? "yes" : "no"}</div>
                                <div>Last sweep: {state.snapshot.lastSweepAt ? <Timestamp value={state.snapshot.lastSweepAt} /> : "n/a"}</div>
                            </div>
                            <div className="p-2">
                                <div>Total records: {state.snapshot.totalRecords}</div>
                                <div>Total bytes: {formatBytes(state.snapshot.totalBytes)}</div>
                                <div>
                                    Quota estimate: {formatBytes(state.snapshot.estimatedUsageBytes)} / {formatBytes(state.snapshot.estimatedQuotaBytes)}
                                </div>
                            </div>
                            <div className="p-2">
                                <div>Critical load ms: {state.perfSnapshot?.lastCriticalLoadMs ?? "n/a"}</div>
                                <div>Deferred load ms: {state.perfSnapshot?.lastDeferredLoadMs ?? "n/a"}</div>
                                <div>Long tasks: {state.perfSnapshot?.longTaskCount ?? 0}</div>
                                <div>Worker queue depth: {state.perfSnapshot?.workerQueueDepth ?? 0}</div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-2">
                        <h3 className="text-[12px] font-medium">Tier Summary</h3>
                        <div className="text-[12px]">
                            {tierOrder.map((tier) => {
                                const summary = state.snapshot?.tiers[tier];
                                return summary ? (
                                    <div key={tier} className="grid grid-cols-1 gap-2 p-2 md:grid-cols-5">
                                        <div className="font-medium capitalize">{tier}</div>
                                        <div>Records: {summary.count}</div>
                                        <div>Bytes: {formatBytes(summary.approxBytes)}</div>
                                        <div>Oldest: {summary.oldestUpdatedAt ? <Timestamp value={summary.oldestUpdatedAt} /> : "n/a"}</div>
                                        <div>Newest: {summary.newestUpdatedAt ? <Timestamp value={summary.newestUpdatedAt} /> : "n/a"}</div>
                                    </div>
                                ) : null;
                            })}
                        </div>
                    </section>

                    <section className="space-y-2">
                        <h3 className="text-[12px] font-medium">Collections</h3>
                        <div className="text-[12px]">
                            {state.snapshot.collections.map((summary) => (
                                <div key={`${summary.tier}:${summary.name}`} className="grid grid-cols-1 gap-2 p-2 md:grid-cols-7">
                                    <div className="min-w-0 font-medium md:col-span-2">
                                        <div className="break-all" title={summary.name}>
                                            {summary.name}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">tier: {summary.tier}</div>
                                    </div>
                                    <div>Records: {summary.count}</div>
                                    <div>Bytes: {formatBytes(summary.approxBytes)}</div>
                                    <div>Expired: {summary.expiredCount}</div>
                                    <div>Oldest: {summary.oldestUpdatedAt ? <Timestamp value={summary.oldestUpdatedAt} /> : "n/a"}</div>
                                    <div>Newest: {summary.newestUpdatedAt ? <Timestamp value={summary.newestUpdatedAt} /> : "n/a"}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            ) : null}

            <section className="space-y-2">
                <h3 className="text-[12px] font-medium">Actions</h3>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" disabled={state.busyAction !== null} onClick={() => void runClearExpired()}>
                        Clear expired now
                    </Button>
                    <Button variant="outline" size="sm" disabled={state.busyAction !== null} onClick={() => void runExportDiagnostics()}>
                        Export diagnostics JSON
                    </Button>
                </div>
            </section>

            <section className="space-y-1 text-[11px] text-muted-foreground">
                <div>Quota notes: browser storage quotas are dynamic and may be evicted under storage pressure.</div>
                <div>Typical ranges: Chromium around 60% of disk, Firefox around min(10% disk, 10GiB), Safari often around 60% for browser apps.</div>
                <div>localStorage fallback is substantially smaller than IndexedDB.</div>
            </section>
        </div>
    );
}
