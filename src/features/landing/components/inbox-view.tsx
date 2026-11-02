import { Check, ChevronDown, FolderGit, GitPullRequest, Loader2 } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useMemo, useRef, useState } from "react";
import { GitHostIcon } from "@/components/git-host-icon";
import { Timestamp } from "@/components/timestamp";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PullRequestUrlField } from "@/features/landing/components/pull-request-url-field";
import {
    buildInboxSections,
    filterInboxRows,
    type InboxFilters,
    type PullRequestTarget,
    parsePullRequestUrl,
    type SortedRootPullRequest,
} from "@/features/landing/model/landing-model";
import type { RepoRef } from "@/lib/git-host/types";
import { cn } from "@/lib/utils";

const UPDATED_OPTIONS: ReadonlyArray<{ label: string; ms: number | null }> = [
    { label: "Any time", ms: null },
    { label: "Last hour", ms: 60 * 60 * 1000 },
    { label: "Last day", ms: 24 * 60 * 60 * 1000 },
    { label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
    { label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
];

const INITIAL_FILTERS: InboxFilters = { query: "", state: "open", author: "", repository: "", updatedWithinMs: null };

function stateBadgeClass(state: string) {
    switch (state.trim().toUpperCase()) {
        case "MERGED":
            return "bg-status-merged/14 text-status-merged";
        case "DECLINED":
        case "SUPERSEDED":
        case "CLOSED":
            return "bg-status-removed/14 text-status-removed";
        case "DRAFT":
            return "bg-status-renamed/14 text-status-renamed";
        default:
            return null;
    }
}

function titleCase(value: string) {
    const lower = value.trim().toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function InboxRow({ row, onOpen }: { row: SortedRootPullRequest; onOpen: () => void }) {
    const { pullRequest, repo, host } = row;
    const authorName = pullRequest.author?.displayName?.trim() || "Unknown";
    const badgeClass = stateBadgeClass(pullRequest.state);
    const source = pullRequest.source?.branch?.name;
    return (
        <button
            type="button"
            data-inbox-row
            className="group flex w-full min-w-0 items-center gap-3 px-3.5 py-2.5 text-left outline-none transition-colors hover:bg-surface-hover focus-visible:bg-selection active:bg-surface-active"
            onClick={onOpen}
        >
            {pullRequest.author?.avatarUrl ? (
                <img src={pullRequest.author.avatarUrl} alt="" title={authorName} className="size-7 shrink-0 rounded-full object-cover" />
            ) : (
                <span
                    title={authorName}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-medium text-muted-foreground"
                >
                    {authorName.slice(0, 2).toUpperCase()}
                </span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-foreground">{pullRequest.title}</span>
                <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-faint-foreground">
                    <GitHostIcon host={host} className="size-3 shrink-0" />
                    <span className="truncate">
                        {repo.fullName} #{pullRequest.id}
                        {source ? ` · ${source}` : ""}
                    </span>
                </span>
            </span>
            {badgeClass ? (
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", badgeClass)}>{titleCase(pullRequest.state)}</span>
            ) : null}
            {pullRequest.updatedAt ? <Timestamp value={pullRequest.updatedAt} className="shrink-0 text-[12px] text-faint-foreground" /> : null}
        </button>
    );
}

function FilterMenu({ label, valueLabel, active, children }: { label: string; valueLabel: string; active: boolean; children: ReactNode }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`Filter by ${label.toLowerCase()}`}
                    className={cn(
                        "pressable inline-flex h-8 max-w-52 items-center gap-1 rounded-full px-3 text-[12px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "bg-selection text-accent" : "bg-surface-hover text-muted-foreground hover:text-foreground",
                    )}
                >
                    <span className="truncate">{valueLabel}</span>
                    <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function FilterOption({ selected, label, onSelect }: { selected: boolean; label: string; onSelect: () => void }) {
    return (
        <DropdownMenuItem className="cursor-pointer" onSelect={onSelect}>
            <Check className={cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
            <span className="truncate">{label}</span>
        </DropdownMenuItem>
    );
}

function uniqueSorted(values: readonly string[]) {
    return Array.from(new Set(values)).toSorted((a, b) => a.localeCompare(b));
}

function InboxFilterBar({
    rows,
    filters,
    onChange,
}: {
    rows: readonly SortedRootPullRequest[];
    filters: InboxFilters;
    onChange: (next: InboxFilters) => void;
}) {
    const authors = useMemo(() => uniqueSorted(rows.map((row) => row.pullRequest.author?.displayName?.trim() || "Unknown")), [rows]);
    const repositories = useMemo(() => uniqueSorted(rows.map((row) => row.repo.fullName)), [rows]);
    const updatedOption = UPDATED_OPTIONS.find((option) => option.ms === filters.updatedWithinMs);
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <SegmentedControl
                label="Pull request state"
                value={filters.state}
                onChange={(state) => onChange({ ...filters, state })}
                options={[
                    { value: "open", label: "Open" },
                    { value: "closed", label: "Closed" },
                    { value: "all", label: "All" },
                ]}
            />
            <FilterMenu label="Repository" valueLabel={filters.repository || "All repositories"} active={Boolean(filters.repository)}>
                <FilterOption selected={!filters.repository} label="All repositories" onSelect={() => onChange({ ...filters, repository: "" })} />
                {repositories.map((repository) => (
                    <FilterOption
                        key={repository}
                        selected={filters.repository === repository}
                        label={repository}
                        onSelect={() => onChange({ ...filters, repository })}
                    />
                ))}
            </FilterMenu>
            <FilterMenu label="Author" valueLabel={filters.author || "Anyone"} active={Boolean(filters.author)}>
                <FilterOption selected={!filters.author} label="Anyone" onSelect={() => onChange({ ...filters, author: "" })} />
                {authors.map((author) => (
                    <FilterOption key={author} selected={filters.author === author} label={author} onSelect={() => onChange({ ...filters, author })} />
                ))}
            </FilterMenu>
            <FilterMenu label="Updated" valueLabel={updatedOption?.label ?? "Any time"} active={filters.updatedWithinMs !== null}>
                {UPDATED_OPTIONS.map((option) => (
                    <FilterOption
                        key={option.label}
                        selected={option.ms === filters.updatedWithinMs}
                        label={option.label}
                        onSelect={() => onChange({ ...filters, updatedWithinMs: option.ms })}
                    />
                ))}
            </FilterMenu>
        </div>
    );
}

function moveRowFocus(event: KeyboardEvent<HTMLElement>) {
    const direction = event.key === "ArrowDown" || event.key === "j" ? 1 : event.key === "ArrowUp" || event.key === "k" ? -1 : 0;
    if (direction === 0) return;
    const target = event.target;
    if (target instanceof HTMLInputElement) return;
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-inbox-row]"));
    const next = rows[rows.indexOf(target as HTMLElement) + direction] ?? (direction === 1 ? rows[0] : undefined);
    if (!next) return;
    event.preventDefault();
    next.focus();
}

function InboxEmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
    return (
        <div className="py-24 text-center">
            <GitPullRequest className="mx-auto mb-3 size-7 text-faint-foreground" aria-hidden="true" />
            <h2 className="section-title text-[17px]">{title}</h2>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">{body}</p>
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}

export function InboxView({
    rows,
    selectedRepoCount,
    isLoading,
    error,
    onOpenPullRequest,
    onOpenTarget,
    onChooseRepositories,
}: {
    rows: readonly SortedRootPullRequest[];
    selectedRepoCount: number;
    isLoading: boolean;
    error: unknown;
    onOpenPullRequest: (repo: RepoRef, pullRequestId: string) => void;
    onOpenTarget: (target: PullRequestTarget) => void;
    onChooseRepositories: () => void;
}) {
    const [filters, setFilters] = useState<InboxFilters>(INITIAL_FILTERS);
    const inputRef = useRef<HTMLInputElement>(null);
    const pastedUrl = parsePullRequestUrl(filters.query) !== null;
    const sections = useMemo(() => buildInboxSections(filterInboxRows(rows, pastedUrl ? { ...filters, query: "" } : filters)), [filters, pastedUrl, rows]);

    const chooseRepositories = (
        <Button className="rounded-full" onClick={onChooseRepositories}>
            <FolderGit className="size-4" />
            Choose repositories
        </Button>
    );

    return (
        <div className="mx-auto w-full max-w-[860px] space-y-5 px-3">
            <PullRequestUrlField
                inputRef={inputRef}
                value={filters.query}
                onChange={(query) => setFilters((prev) => ({ ...prev, query }))}
                onOpenTarget={onOpenTarget}
                placeholder="Filter pull requests or paste a URL"
            />
            {selectedRepoCount > 0 ? <InboxFilterBar rows={rows} filters={filters} onChange={setFilters} /> : null}

            {selectedRepoCount === 0 ? (
                <InboxEmptyState
                    title="Your inbox is empty"
                    body="Choose repositories and their pull requests will appear here, sorted by what needs you."
                    action={chooseRepositories}
                />
            ) : isLoading ? (
                <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground" role="status">
                    <Loader2 className="size-4 animate-spin" />
                    Loading pull requests...
                </div>
            ) : error ? (
                <InboxEmptyState title="Could not load pull requests" body={error instanceof Error ? error.message : "Failed to load pull requests"} />
            ) : sections.length === 0 ? (
                <InboxEmptyState title="Nothing here" body="No pull requests match these filters." />
            ) : (
                // biome-ignore lint/a11y/noStaticElementInteractions: arrow and j/k movement between the row buttons inside
                <div className="space-y-6" onKeyDown={moveRowFocus}>
                    {sections.map((section) => (
                        <section key={section.id} aria-label={section.title}>
                            <h2 className="section-title mb-2 flex items-baseline gap-2 px-1 text-[17px]">
                                {section.title}
                                <span className="text-[13px] font-normal tabular-nums text-faint-foreground">{section.rows.length}</span>
                            </h2>
                            <div className="canvas-card divide-y divide-border-muted overflow-hidden">
                                {section.rows.map((row) => (
                                    <InboxRow
                                        key={`${row.repoKey}:${row.pullRequest.id}`}
                                        row={row}
                                        onOpen={() => onOpenPullRequest(row.repo, String(row.pullRequest.id))}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
