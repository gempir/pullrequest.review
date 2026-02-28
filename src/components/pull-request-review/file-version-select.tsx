import { ChevronDown, Loader2 } from "lucide-react";
import { formatRecentTimestamp } from "@/components/pull-request-review/review-formatters";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FileVersionSelectOption = {
    id: string;
    label: string;
    unread: boolean;
    latest: boolean;
    commitMessage?: string;
    commitDate?: string;
    state?: "loading" | "error";
};

function formatCommitDate(commitDate?: string) {
    if (!commitDate) return null;
    return formatRecentTimestamp(commitDate);
}

export function FileVersionSelect({
    value,
    options,
    onValueChange,
    onOpenChange,
}: {
    value: string;
    options: FileVersionSelectOption[];
    onValueChange: (value: string) => void;
    onOpenChange?: (open: boolean) => void;
}) {
    const selected = options.find((option) => option.id === value) ?? options[0];
    if (!selected) return null;
    const isLoadingHistory = options.some((option) => option.state === "loading");
    const selectedDate = formatCommitDate(selected.commitDate);

    return (
        <DropdownMenu onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="h-7 min-w-[110px] max-w-[190px] border-0 bg-background px-2 text-[11px] font-mono flex items-center gap-1.5 outline-none transition-colors hover:bg-secondary data-[state=open]:bg-secondary focus-visible:ring-0"
                    aria-label="Select file version"
                >
                    {isLoadingHistory ? <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" /> : null}
                    <span className="min-w-0 flex-1 text-left">
                        <span className={cn("block truncate", selected.unread ? "text-status-renamed" : "text-foreground")}>{selected.label}</span>
                        {selectedDate ? <span className="block truncate text-[10px] text-muted-foreground">{selectedDate}</span> : null}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start" sideOffset={4} className="w-[26rem] max-h-[min(70vh,32rem)] overflow-y-auto p-0">
                {options.map((option) => (
                    <DropdownMenuItem
                        key={option.id}
                        disabled={option.state === "loading" || option.state === "error"}
                        className={cn(
                            "cursor-pointer rounded-none px-2 py-1.5 text-[11px] font-mono items-start",
                            option.id === selected.id ? "bg-status-renamed/20 focus:bg-status-renamed/25" : "",
                        )}
                        onSelect={(event) => {
                            if (option.state === "loading" || option.state === "error") {
                                event.preventDefault();
                                return;
                            }
                            onValueChange(option.id);
                        }}
                    >
                        <span className="flex min-w-0 flex-1 items-start gap-2">
                            {option.state === "loading" ? <Loader2 className="mt-[1px] size-3 shrink-0 animate-spin text-muted-foreground" /> : null}
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                    <span className="min-w-0 flex-1 truncate">
                                        {option.label}
                                        {option.latest && option.label !== "Latest" ? <span className="ml-1 text-muted-foreground">(latest)</span> : null}
                                    </span>
                                    {option.commitDate ? (
                                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatCommitDate(option.commitDate)}</span>
                                    ) : null}
                                </span>
                                {option.commitMessage ? <span className="block truncate text-[10px] text-muted-foreground">{option.commitMessage}</span> : null}
                            </span>
                        </span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
