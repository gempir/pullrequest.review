import { useLiveQuery } from "@tanstack/react-db";
import { AlertCircle, FolderGit, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getRepositoryCollection } from "@/lib/git-host/query-collections";
import type { GitHost, RepoRef } from "@/lib/git-host/types";

export function RepositorySelector({
    host,
    initialSelected,
    onSave,
    onCancel,
    saveLabel = "Save Repositories",
}: {
    host: GitHost;
    initialSelected: RepoRef[];
    onSave: (repos: RepoRef[]) => void;
    onCancel?: () => void;
    saveLabel?: string;
}) {
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const autoRefetchHostRef = useRef<GitHost | null>(null);

    const initialSelection = useMemo(() => [...initialSelected.map((repo) => repo.fullName)].sort(), [initialSelected]);
    const initialSelectionKey = initialSelection.join("|");

    useEffect(() => {
        // Sync from parent only when the semantic selection actually changes.
        setSelected(new Set(initialSelectionKey ? initialSelectionKey.split("|") : []));
    }, [initialSelectionKey]);

    const repositoryCollection = useMemo(() => getRepositoryCollection(host), [host]);
    const repositoriesQuery = useLiveQuery(
        (q) => q.from({ repository: repositoryCollection.collection }).select(({ repository }) => ({ ...repository })),
        [repositoryCollection],
    );

    useEffect(() => {
        if (repositoryCollection.utils.isFetching) return;
        if (repositoryCollection.utils.lastError) return;
        if (autoRefetchHostRef.current === host) return;
        autoRefetchHostRef.current = host;
        void repositoryCollection.utils.refetch({ throwOnError: false });
    }, [host, repositoryCollection]);

    const entries = useMemo(() => (repositoriesQuery.data ?? []).filter((repo) => repo.host === host), [host, repositoriesQuery.data]);
    const repositoryError = repositoryCollection.utils.lastError;
    const isRepositoryLoading = repositoriesQuery.isLoading || (repositoryCollection.utils.isFetching && entries.length === 0);
    const filtered = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return entries;
        return entries.filter((repo) => {
            const fullName = repo.fullName.toLowerCase();
            const displayName = repo.displayName.toLowerCase();
            return fullName.includes(term) || displayName.includes(term);
        });
    }, [entries, query]);

    return (
        <div className="space-y-4 rounded-md border border-border-muted bg-surface-1 p-4">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <FolderGit className="size-4" />
                <span>Select repositories to include on the landing page.</span>
            </div>

            <div className="rounded-md border border-border-muted bg-background">
                <div className="relative border-b border-border-muted">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter repositories..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="h-10 rounded-none border-0 bg-transparent pl-9 focus-visible:ring-0"
                    />
                </div>

                {isRepositoryLoading ? (
                    <div className="p-8 text-center text-muted-foreground text-[13px]">
                        <div className="flex items-center justify-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            <span>Loading repositories...</span>
                        </div>
                    </div>
                ) : repositoryError ? (
                    <div className="m-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive text-[13px]">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="size-4" />
                            <span>{repositoryError instanceof Error ? repositoryError.message : "Failed to load repositories"}</span>
                        </div>
                    </div>
                ) : (
                    <div className="max-h-80 overflow-auto p-2">
                        <div className="space-y-1">
                            {filtered.map((repo) => {
                                const checked = selected.has(repo.fullName);
                                return (
                                    <label
                                        key={repo.fullName}
                                        className="flex cursor-pointer items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-[13px] transition-colors hover:border-border-muted hover:bg-surface-2"
                                    >
                                        <input
                                            type="checkbox"
                                            className="size-4 shrink-0 rounded-[3px] border border-border-muted bg-muted accent-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            checked={checked}
                                            onChange={(e) => {
                                                setSelected((prev) => {
                                                    const next = new Set(prev);
                                                    if (e.target.checked) next.add(repo.fullName);
                                                    else next.delete(repo.fullName);
                                                    return next;
                                                });
                                            }}
                                        />
                                        <span className="flex-1 truncate font-mono text-[12px] text-foreground">{repo.fullName}</span>
                                    </label>
                                );
                            })}
                            {filtered.length === 0 && (
                                <div className="px-4 py-8 text-center text-muted-foreground text-[13px]">No repositories match your filter.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
                {onCancel && (
                    <Button variant="outline" className="rounded-md" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button
                    className="rounded-md"
                    onClick={() => {
                        const selectedRepos = entries.filter((repo) => selected.has(repo.fullName));
                        onSave(selectedRepos);
                    }}
                    disabled={isRepositoryLoading}
                >
                    {saveLabel} ({selected.size})
                </Button>
            </div>
        </div>
    );
}
