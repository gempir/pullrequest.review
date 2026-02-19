import { readReviewPerfV2FlagRecord, writeReviewPerfV2FlagRecord } from "@/lib/data/query-collections";

function readStoredFlag() {
    return readReviewPerfV2FlagRecord();
}

export function isReviewPerfV2Enabled() {
    const envFlag = import.meta.env.VITE_REVIEW_PERF_V2;
    if (envFlag === "0" || envFlag === "false") return false;
    if (envFlag === "1" || envFlag === "true") return true;
    const storedFlag = readStoredFlag();
    if (storedFlag !== null) return storedFlag;
    return true;
}

export function setReviewPerfV2Enabled(enabled: boolean) {
    writeReviewPerfV2FlagRecord(enabled);
}
