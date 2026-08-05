import {
    type Column,
    type ColumnDef,
    columnFilteringFeature,
    columnVisibilityFeature,
    createFilteredRowModel,
    createSortedRowModel,
    filterFn_equalsString,
    filterFn_includesString,
    rowSortingFeature,
    sortFn_alphanumeric,
    sortFn_datetime,
    sortFn_text,
    tableFeatures,
    useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { GitHostIcon } from "@/components/git-host-icon";
import { Timestamp } from "@/components/timestamp";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SortedRootPullRequest } from "@/features/landing/model/landing-model";
import { getHostLabel } from "@/lib/git-host/service";
import type { RepoRef } from "@/lib/git-host/types";
import { cn } from "@/lib/utils";

const UPDATED_WITHIN_OPTIONS = [
    { value: "", label: "Any" },
    { value: "1m", label: "1m" },
    { value: "5m", label: "5m" },
    { value: "1h", label: "1h" },
    { value: "1d", label: "1d" },
    { value: "7d", label: "7d" },
    { value: "30d", label: "30d" },
] as const;

const UPDATED_WITHIN_MS: Record<string, number> = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
};

function authorInitials(name?: string) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() || "?";
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

function AuthorAvatar({ name, url }: { name: string; url?: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex">
                    {url ? (
                        <img src={url} alt="" className="size-5 shrink-0 rounded-full object-cover" />
                    ) : (
                        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-border-muted bg-surface-1 text-[9px] font-medium text-muted-foreground">
                            {authorInitials(name)}
                        </span>
                    )}
                    <span className="sr-only">{name}</span>
                </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{name}</TooltipContent>
        </Tooltip>
    );
}

function pullRequestStateBadgeClass(state: string) {
    switch (state.trim().toUpperCase()) {
        case "MERGED":
            return "border-status-merged/40 bg-status-merged/15 text-status-merged";
        case "DECLINED":
        case "SUPERSEDED":
        case "CLOSED":
            return "border-status-removed/40 bg-status-removed/15 text-status-removed";
        case "DRAFT":
            return "border-status-renamed/40 bg-status-renamed/15 text-status-renamed";
        default:
            return "border-status-added/40 bg-status-added/15 text-status-added";
    }
}

function PullRequestStateBadge({ state }: { state: string }) {
    const label = state.trim() || "OPEN";
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                pullRequestStateBadgeClass(label),
            )}
        >
            {label}
        </span>
    );
}

const landingPullRequestTableFeatures = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    columnVisibilityFeature,
    sortedRowModel: createSortedRowModel(),
    filteredRowModel: createFilteredRowModel(),
    filterFns: {
        includesString: filterFn_includesString,
        equalsString: filterFn_equalsString,
    },
    sortFns: {
        alphanumeric: sortFn_alphanumeric,
        datetime: sortFn_datetime,
        text: sortFn_text,
    },
});

type LandingPullRequestTableFeatures = typeof landingPullRequestTableFeatures;

const filterControlClassName = "h-7 w-full min-w-0 rounded-sm border-border-muted bg-surface-1 px-1.5 text-[11px] font-normal normal-case tracking-normal";

function SortIndicator({ sorted }: { sorted: false | "asc" | "desc" }) {
    if (sorted === "asc") return <ArrowUp className="size-3" />;
    if (sorted === "desc") return <ArrowDown className="size-3" />;
    return <ArrowUpDown className="size-3 opacity-40" />;
}

function ColumnTextFilter({ column, placeholder }: { column: Column<LandingPullRequestTableFeatures, SortedRootPullRequest>; placeholder: string }) {
    const value = String(column.getFilterValue() ?? "");
    return (
        <Input
            className={filterControlClassName}
            value={value}
            placeholder={placeholder}
            aria-label={`Filter ${column.id}`}
            onChange={(event) => {
                const next = event.target.value;
                column.setFilterValue(next.trim().length > 0 ? next : undefined);
            }}
            onClick={(event) => {
                event.stopPropagation();
            }}
        />
    );
}

function ColumnSelectFilter({
    column,
    ariaLabel,
    options,
}: {
    column: Column<LandingPullRequestTableFeatures, SortedRootPullRequest>;
    ariaLabel: string;
    options: Array<{ value: string; label: string }>;
}) {
    const value = String(column.getFilterValue() ?? "");
    return (
        <select
            className={cn(filterControlClassName, "text-foreground")}
            value={value}
            aria-label={ariaLabel}
            onChange={(event) => {
                const next = event.target.value;
                column.setFilterValue(next.length > 0 ? next : undefined);
            }}
            onClick={(event) => {
                event.stopPropagation();
            }}
        >
            {options.map((option) => (
                <option key={option.value || "__all__"} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

function ColumnMenuFilter({
    column,
    ariaLabel,
    options,
    renderOptionLabel,
}: {
    column: Column<LandingPullRequestTableFeatures, SortedRootPullRequest>;
    ariaLabel: string;
    options: Array<{ value: string; label: string }>;
    renderOptionLabel?: (option: { value: string; label: string }) => ReactNode;
}) {
    const value = String(column.getFilterValue() ?? "");
    const active = value.length > 0;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex size-7 shrink-0 items-center justify-center rounded-sm border border-border-muted bg-surface-1 text-muted-foreground transition-colors hover:text-foreground",
                        active ? "border-foreground/40 text-foreground" : null,
                    )}
                    aria-label={ariaLabel}
                    title={active ? options.find((option) => option.value === value)?.label || ariaLabel : ariaLabel}
                    onClick={(event) => {
                        event.stopPropagation();
                    }}
                >
                    <ChevronDown className="size-3.5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                {options.map((option) => {
                    const selected = option.value === value || (!option.value && !active);
                    return (
                        <DropdownMenuItem
                            key={option.value || "__all__"}
                            className="gap-2"
                            onSelect={() => {
                                column.setFilterValue(option.value.length > 0 ? option.value : undefined);
                            }}
                        >
                            <Check className={cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                            {renderOptionLabel ? renderOptionLabel(option) : <span className="truncate">{option.label}</span>}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function columnWidthClass(columnId: string) {
    switch (columnId) {
        case "author":
            return "w-10";
        case "state":
            return "w-16";
        case "title":
            return "w-[34%]";
        case "branches":
            return "w-[22%]";
        case "updated":
            return "w-24";
        case "repository":
            return "w-[20%]";
        default:
            return undefined;
    }
}

function createLandingPullRequestColumns(): Array<ColumnDef<LandingPullRequestTableFeatures, SortedRootPullRequest>> {
    return [
        {
            id: "author",
            accessorFn: (row) => row.pullRequest.author?.displayName?.trim() || "Unknown",
            header: () => <span className="sr-only">Author</span>,
            filterFn: "equalsString",
            sortFn: "text",
            cell: ({ row }) => {
                const name = row.original.pullRequest.author?.displayName?.trim() || "Unknown";
                return <AuthorAvatar name={name} url={row.original.pullRequest.author?.avatarUrl} />;
            },
            meta: { filter: "author" as const },
        },
        {
            id: "state",
            accessorFn: (row) => row.pullRequest.state,
            header: () => <span className="sr-only">State</span>,
            filterFn: "equalsString",
            sortFn: "text",
            cell: ({ getValue }) => <PullRequestStateBadge state={getValue<string>()} />,
            meta: { filter: "state" as const },
        },
        {
            id: "title",
            accessorFn: (row) => `#${row.pullRequest.id} ${row.pullRequest.title}`,
            header: "Title",
            filterFn: "includesString",
            sortFn: "text",
            cell: ({ row }) => {
                const label = `#${row.original.pullRequest.id} ${row.original.pullRequest.title}`;
                return (
                    <span className="block min-w-0 truncate font-medium text-foreground" title={label}>
                        <span className="text-muted-foreground">#{row.original.pullRequest.id}</span> {row.original.pullRequest.title}
                    </span>
                );
            },
            meta: { filter: "title" as const },
        },
        {
            id: "branches",
            accessorFn: (row) => `${row.pullRequest.source?.branch?.name ?? "source"} -> ${row.pullRequest.destination?.branch?.name ?? "target"}`,
            header: "Branches",
            enableSorting: false,
            filterFn: "includesString",
            cell: ({ getValue }) => (
                <span className="block min-w-0 truncate font-mono text-[11px] text-muted-foreground" title={getValue<string>()}>
                    {getValue<string>()}
                </span>
            ),
            meta: { filter: "branches" as const },
        },
        {
            id: "updated",
            accessorFn: (row) => row.pullRequest.updatedAt ?? "",
            header: "Updated",
            sortFn: "datetime",
            filterFn: (row, columnId, filterValue) => {
                if (!filterValue) return true;
                const windowMs = UPDATED_WITHIN_MS[String(filterValue)];
                if (!windowMs) return true;
                const raw = row.getValue<string>(columnId);
                if (!raw) return false;
                const updatedAt = Date.parse(raw);
                if (Number.isNaN(updatedAt)) return false;
                return Date.now() - updatedAt <= windowMs;
            },
            cell: ({ row }) =>
                row.original.pullRequest.updatedAt ? (
                    <Timestamp value={row.original.pullRequest.updatedAt} className="text-muted-foreground" />
                ) : (
                    <span>—</span>
                ),
            meta: { filter: "updated" as const },
        },
        {
            id: "repository",
            accessorFn: (row) => row.repo.fullName,
            header: "Repository",
            filterFn: "includesString",
            sortFn: "alphanumeric",
            cell: ({ row }) => (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                    <span className="inline-flex shrink-0 items-center" title={getHostLabel(row.original.host)}>
                        <GitHostIcon host={row.original.host} className="size-3.5" />
                        <span className="sr-only">{getHostLabel(row.original.host)}</span>
                    </span>
                    <span className="min-w-0 truncate font-mono text-[12px] text-muted-foreground" title={row.original.repo.fullName}>
                        {row.original.repo.fullName}
                    </span>
                </span>
            ),
            meta: { filter: "repository" as const },
        },
        {
            id: "host",
            accessorFn: (row) => row.host,
            header: "Host",
            filterFn: "equalsString",
            enableSorting: false,
            enableColumnFilter: false,
            cell: () => null,
        },
    ];
}

function renderColumnFilter(
    column: Column<LandingPullRequestTableFeatures, SortedRootPullRequest>,
    authorOptions: Array<{ value: string; label: string }>,
    stateOptions: Array<{ value: string; label: string }>,
) {
    const filterKind = (column.columnDef.meta as { filter?: string } | undefined)?.filter;
    switch (filterKind) {
        case "author":
            return <ColumnMenuFilter column={column} ariaLabel="Filter by author" options={authorOptions} />;
        case "state":
            return (
                <ColumnMenuFilter
                    column={column}
                    ariaLabel="Filter by state"
                    options={stateOptions}
                    renderOptionLabel={(option) =>
                        option.value ? <PullRequestStateBadge state={option.value} /> : <span className="text-muted-foreground">Any</span>
                    }
                />
            );
        case "title":
            return <ColumnTextFilter column={column} placeholder="Title or #id" />;
        case "branches":
            return <ColumnTextFilter column={column} placeholder="Branch" />;
        case "updated":
            return (
                <ColumnSelectFilter
                    column={column}
                    ariaLabel="Filter by updated time"
                    options={UPDATED_WITHIN_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                />
            );
        case "repository":
            return <ColumnTextFilter column={column} placeholder="Repository" />;
        default:
            return null;
    }
}

export function LandingPullRequestTable({
    data,
    onOpenPullRequest,
}: {
    data: SortedRootPullRequest[];
    onOpenPullRequest: (repo: RepoRef, pullRequestId: string) => void;
}) {
    const columns = useMemo(() => createLandingPullRequestColumns(), []);
    const authorOptions = useMemo(() => {
        const authors = new Set<string>();
        for (const row of data) {
            authors.add(row.pullRequest.author?.displayName?.trim() || "Unknown");
        }
        return [
            { value: "", label: "Any" },
            ...Array.from(authors)
                .sort((a, b) => a.localeCompare(b))
                .map((author) => ({ value: author, label: author })),
        ];
    }, [data]);
    const stateOptions = useMemo(() => {
        const states = new Set<string>();
        for (const row of data) {
            if (row.pullRequest.state) states.add(row.pullRequest.state);
        }
        return [
            { value: "", label: "Any" },
            ...Array.from(states)
                .sort((a, b) => a.localeCompare(b))
                .map((state) => ({ value: state, label: state })),
        ];
    }, [data]);

    const table = useTable(
        {
            features: landingPullRequestTableFeatures,
            columns,
            data,
            getRowId: (row) => `${row.host}:${row.repo.fullName}:${row.pullRequest.id}`,
            initialState: {
                sorting: [{ id: "updated", desc: true }],
                columnVisibility: { host: false },
            },
        },
        (state) => ({
            sorting: state.sorting,
            columnFilters: state.columnFilters,
            columnVisibility: state.columnVisibility,
        }),
    );

    const filteredCount = table.getRowModel().rows.length;

    return (
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border-muted bg-surface-1">
            <table className="w-full table-fixed border-collapse text-left text-[13px]">
                <thead className="sticky top-0 z-10 bg-chrome">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={`${headerGroup.id}-filters`}>
                            {headerGroup.headers.map((header) => (
                                <th key={`${header.id}-filter`} className={cn("px-2 pb-0 pt-1.5 align-bottom font-normal", columnWidthClass(header.column.id))}>
                                    {header.isPlaceholder || !header.column.getCanFilter()
                                        ? null
                                        : renderColumnFilter(header.column, authorOptions, stateOptions)}
                                </th>
                            ))}
                        </tr>
                    ))}
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id} className="border-b border-border-muted">
                            {headerGroup.headers.map((header) => {
                                const canSort = header.column.getCanSort();
                                const sorted = header.column.getIsSorted();
                                return (
                                    <th
                                        key={header.id}
                                        className={cn(
                                            "px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                                            columnWidthClass(header.column.id),
                                        )}
                                    >
                                        {header.isPlaceholder ? null : canSort ? (
                                            <button
                                                type="button"
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 transition-colors hover:text-foreground",
                                                    sorted ? "text-foreground" : "",
                                                )}
                                                onClick={header.column.getToggleSortingHandler()}
                                            >
                                                <table.FlexRender header={header} />
                                                <SortIndicator sorted={sorted} />
                                            </button>
                                        ) : (
                                            <table.FlexRender header={header} />
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {filteredCount === 0 ? (
                        <tr>
                            <td colSpan={table.getVisibleLeafColumns().length} className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                                No pull requests match the current filters.
                            </td>
                        </tr>
                    ) : (
                        table.getRowModel().rows.map((row) => (
                            <tr
                                key={row.id}
                                className="cursor-pointer border-b border-border-muted/70 transition-colors hover:bg-surface-hover"
                                onClick={() => onOpenPullRequest(row.original.repo, String(row.original.pullRequest.id))}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className={cn("overflow-hidden px-3 py-2 align-middle", columnWidthClass(cell.column.id))}>
                                        <table.FlexRender cell={cell} />
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
