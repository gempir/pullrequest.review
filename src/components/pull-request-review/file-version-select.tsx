import type { StoredFileVersion } from "@/components/pull-request-review/use-review-storage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FileVersionSelectOption = {
    id: string;
    label: string;
    unread: boolean;
    latest: boolean;
    version: StoredFileVersion;
};

export function FileVersionSelect({
    value,
    options,
    onValueChange,
}: {
    value: string;
    options: FileVersionSelectOption[];
    onValueChange: (value: string) => void;
}) {
    const selected = options.find((option) => option.id === value) ?? options[0];
    if (!selected || options.length <= 1) return null;

    return (
        <Select value={selected.id} onValueChange={onValueChange}>
            <SelectTrigger size="sm" className="h-7 min-w-[92px] max-w-[132px] px-2 text-[11px] font-mono">
                <SelectValue>
                    <span className={cn("truncate", selected.unread ? "text-status-renamed" : "text-foreground")}>{selected.label}</span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
                {options.map((option) => (
                    <SelectItem key={option.id} value={option.id} className="text-[11px] font-mono">
                        <span className="flex min-w-0 items-center gap-2">
                            <span className={cn("inline-block w-2", option.unread ? "text-status-renamed" : "text-muted-foreground")}>
                                {option.unread ? "*" : " "}
                            </span>
                            <span className="truncate">{option.label}</span>
                            {option.latest ? <span className="text-muted-foreground">(latest)</span> : null}
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
