export type TimestampValue = string | number | Date | null | undefined;

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const COMMENT_MINUTES_THRESHOLD_MS = HOUR_MS;
const COMMENT_TIME_ONLY_THRESHOLD_MS = 12 * HOUR_MS;
const COMMENT_TIME_OPTIONS: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
const COMMENT_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
const COMMENT_EXACT_DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { ...COMMENT_DATE_TIME_OPTIONS, second: "2-digit" };

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

export function describeTimestamp(value: TimestampValue, { unknownLabel = "Unknown" }: { unknownLabel?: string } = {}) {
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
    if (ageMs < DAY_MS) {
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

function formatMinutesAgo(ageMs: number) {
    const minutes = Math.max(1, Math.floor(ageMs / MINUTE_MS));
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
}

// Comment rules: under 1h "N minutes ago", under 12h the local time, otherwise the full local date and time.
// `absoluteLabel` is the exact local date and time including seconds, for tooltips and titles.
// `isRelative` is true when the label is abbreviated (minutes or time only).
export function describeCommentTimestamp(value: TimestampValue, { unknownLabel = "Unknown", now = Date.now() }: { unknownLabel?: string; now?: number } = {}) {
    const parsed = parseTimestamp(value);
    if (!parsed) {
        return {
            label: typeof value === "string" && value.trim().length > 0 ? value : unknownLabel,
            absoluteLabel: null,
            isRelative: false,
        };
    }

    const absoluteLabel = parsed.toLocaleString(undefined, COMMENT_EXACT_DATE_TIME_OPTIONS);
    const ageMs = Math.max(0, now - parsed.getTime());
    if (ageMs < COMMENT_MINUTES_THRESHOLD_MS) {
        return { label: formatMinutesAgo(ageMs), absoluteLabel, isRelative: true };
    }
    if (ageMs < COMMENT_TIME_ONLY_THRESHOLD_MS) {
        return { label: parsed.toLocaleTimeString(undefined, COMMENT_TIME_OPTIONS), absoluteLabel, isRelative: true };
    }
    return { label: parsed.toLocaleString(undefined, COMMENT_DATE_TIME_OPTIONS), absoluteLabel, isRelative: false };
}

// A comment shows when it was last edited, falling back to when it was created.
export function commentTimestampSource(comment: { createdAt?: string; updatedAt?: string }) {
    return comment.updatedAt ?? comment.createdAt;
}

export function formatTimestampLabel(value: TimestampValue, options?: { unknownLabel?: string }) {
    return describeTimestamp(value, options).label;
}
