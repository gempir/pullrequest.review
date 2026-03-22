export type TimestampValue = string | number | Date | null | undefined;

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const ABSOLUTE_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
});

function parseTimestamp(value: TimestampValue) {
    if (value === null || value === undefined) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

export function timestampValue(value: TimestampValue) {
    return parseTimestamp(value)?.getTime() ?? 0;
}

function formatAbsoluteTimestamp(value: TimestampValue) {
    const parsed = parseTimestamp(value);
    if (!parsed) {
        return typeof value === "string" && value.trim().length > 0 ? value : "Unknown";
    }
    return ABSOLUTE_TIMESTAMP_FORMATTER.format(parsed);
}

function formatCompactRelativeTimestamp(value: Date, now: Date) {
    const diffMs = value.getTime() - now.getTime();
    const absMs = Math.abs(diffMs);
    const prefix = diffMs >= 0 ? "in " : "";
    const suffix = diffMs < 0 ? " ago" : "";

    if (absMs < MINUTE_MS) {
        const seconds = Math.max(1, Math.round(absMs / SECOND_MS));
        return `${prefix}${seconds}s${suffix}`;
    }
    if (absMs < HOUR_MS) {
        const minutes = Math.max(1, Math.round(absMs / MINUTE_MS));
        return `${prefix}${minutes}m${suffix}`;
    }
    const hours = Math.max(1, Math.round(absMs / HOUR_MS));
    return `${prefix}${hours}h${suffix}`;
}

export function describeTimestamp(
    value: TimestampValue,
    { unknownLabel = "Unknown", relativeThresholdMs = DAY_MS }: { unknownLabel?: string; relativeThresholdMs?: number } = {},
) {
    const parsed = parseTimestamp(value);
    if (!parsed) {
        return {
            label: typeof value === "string" && value.trim().length > 0 ? value : unknownLabel,
            absoluteLabel: null,
            isRelative: false,
        };
    }

    const absoluteLabel = formatAbsoluteTimestamp(parsed);
    const ageMs = Math.abs(Date.now() - parsed.getTime());
    if (ageMs < relativeThresholdMs) {
        return {
            label: formatCompactRelativeTimestamp(parsed, new Date()),
            absoluteLabel,
            isRelative: true,
        };
    }

    return {
        label: absoluteLabel,
        absoluteLabel,
        isRelative: false,
    };
}

export function formatTimestampLabel(value: TimestampValue, options?: { unknownLabel?: string; relativeThresholdMs?: number }) {
    return describeTimestamp(value, options).label;
}
