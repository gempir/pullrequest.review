import {
    type ColumnDef,
    columnFilteringFeature,
    columnVisibilityFeature,
    createFilteredRowModel,
    createSortedRowModel,
    filterFn_equalsString,
    filterFn_includesString,
    globalFilteringFeature,
    rowSortingFeature,
    sortFn_alphanumeric,
    sortFn_datetime,
    sortFn_text,
    tableFeatures,
    useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useEffect, useMemo } from "react";
import { GitHostIcon } from "@/components/git-host-icon";
import { Timestamp } from "@/components/timestamp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SortedRootPullRequest } from "@/features/landing/model/landing-model";
import { getHostLabel } from "@/lib/git-host/service";
import type { RepoRef } from "@/lib/git-host/types";
import { cn } from "@/lib/utils";

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
    globalFilteringFeature,
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

function SortIndicator({ sorted }: { sorted: false | "asc" | "desc" }) {
    if (sorted === "asc") return <ArrowUp className="size-3" />;
    if (sorted === "desc") return <ArrowDown className="size-3" />;
    return <ArrowUpDown className="size-3 opacity-40" />;
}

function createLandingPullRequestColumns(): Array<ColumnDef<LandingPullRequestTableFeatures, SortedRootPullRequest>> {
    return [
        {
            id: "author",
            accessorFn: (row) => row.pullRequest.author?.displayName ?? "",
            header: () => <span className="sr-only">Author</span>,
            filterFn: "includesString",
            sortFn: "text",
            cell: ({ row }) => {
                const name = row.original.pullRequest.author?.displayName?.trim() || "Unknown";
                return <AuthorAvatar name={name} url={row.original.pullRequest.author?.avatarUrl} />;
            },
        },
        {
            id: "state",
            accessorFn: (row) => row.pullRequest.state,
            header: "State",
            filterFn: "equalsString",
            sortFn: "text",
            cell: ({ getValue }) => <PullRequestStateBadge state={getValue<string>()} />,
        },
        {
            id: "title",
            accessorFn: (row) => row.pullRequest.title,
            header: "Title",
            filterFn: "includesString",
            sortFn: "text",
            cell: ({ row }) => (
                <span className="block min-w-0 max-w-full truncate font-medium text-foreground">
                    <span className="text-muted-foreground">#{row.original.pullRequest.id}</span> {row.original.pullRequest.title}
                </span>
            ),
        },
        {
            id: "branches",
            accessorFn: (row) => `${row.pullRequest.source?.branch?.name ?? "source"} -> ${row.pullRequest.destination?.branch?.name ?? "target"}`,
            header: "Branches",
            enableSorting: false,
            enableColumnFilter: false,
            cell: ({ getValue }) => <span className="font-mono text-[11px] text-muted-foreground">{getValue<string>()}</span>,
        },
        {
            id: "updated",
            accessorFn: (row) => row.pullRequest.updatedAt ?? "",
            header: "Updated",
            sortFn: "datetime",
            enableColumnFilter: false,
            cell: ({ row }) =>
                row.original.pullRequest.updatedAt ? (
                    <Timestamp value={row.original.pullRequest.updatedAt} className="text-muted-foreground" />
                ) : (
                    <span>—</span>
                ),
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
                    <span className="truncate font-mono text-[12px] text-muted-foreground">{row.original.repo.fullName}</span>
                </span>
            ),
        },
        {
            id: "host",
            accessorFn: (row) => row.host,
            header: "Host",
            filterFn: "equalsString",
            enableSorting: false,
            cell: () => null,
        },
    ];
}

export function LandingPullRequestTable({
    data,
    globalFilter,
    hostFilter,
    stateFilter,
    onOpenPullRequest,
    onFilteredCountChange,
}: {
    data: SortedRootPullRequest[];
    globalFilter: string;
    hostFilter: string;
    stateFilter: string;
    onOpenPullRequest: (repo: RepoRef, pullRequestId: string) => void;
    onFilteredCountChange?: (filteredCount: number, totalCount: number) => void;
}) {
    const columns = useMemo(() => createLandingPullRequestColumns(), []);
    const columnFilters = useMemo(() => {
        const filters: Array<{ id: string; value: string }> = [];
        if (hostFilter) filters.push({ id: "host", value: hostFilter });
        if (stateFilter) filters.push({ id: "state", value: stateFilter });
        return filters;
    }, [hostFilter, stateFilter]);

    const table = useTable(
        {
            features: landingPullRequestTableFeatures,
            columns,
            data,
            getRowId: (row) => `${row.host}:${row.repo.fullName}:${row.pullRequest.id}`,
            state: {
                globalFilter,
                columnFilters,
            },
            initialState: {
                sorting: [{ id: "updated", desc: true }],
                columnVisibility: { host: false },
            },
        },
        (state) => ({
            sorting: state.sorting,
            columnFilters: state.columnFilters,
            globalFilter: state.globalFilter,
            columnVisibility: state.columnVisibility,
        }),
    );

    const filteredCount = table.getRowModel().rows.length;

    useEffect(() => {
        onFilteredCountChange?.(filteredCount, data.length);
    }, [data.length, filteredCount, onFilteredCountChange]);

    return (
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border-muted bg-surface-1">
            <table className="w-full border-collapse text-left text-[13px]">
                <thead className="sticky top-0 z-10 bg-chrome">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id} className="border-b border-border-muted">
                            {headerGroup.headers.map((header) => {
                                const canSort = header.column.getCanSort();
                                const sorted = header.column.getIsSorted();
                                return (
                                    <th key={header.id} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                                    <td key={cell.id} className="px-3 py-2 align-middle">
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
