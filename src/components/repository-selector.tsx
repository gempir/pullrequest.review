import { useQuery } from "@tanstack/react-query";
import { AlertCircle, FolderGit, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listRepositoriesForHost } from "@/lib/git-host/service";
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

  const initialSelection = useMemo(
    () => [...initialSelected.map((repo) => repo.fullName)].sort(),
    [initialSelected],
  );
  const initialSelectionKey = initialSelection.join("|");

  useEffect(() => {
    // Sync from parent only when the semantic selection actually changes.
    setSelected(
      new Set(initialSelectionKey ? initialSelectionKey.split("|") : []),
    );
  }, [initialSelectionKey]);

  const reposQuery = useQuery({
    queryKey: ["repos", host],
    queryFn: () => listRepositoriesForHost({ host }),
  });

  const entries = reposQuery.data ?? [];
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
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <FolderGit className="size-4" />
        <span>Select repositories to include on the landing page.</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Filter repositories..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {reposQuery.isLoading ? (
        <div className="border border-border bg-background p-8 text-center text-muted-foreground text-[13px]">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            <span>Loading repositories...</span>
          </div>
        </div>
      ) : reposQuery.error ? (
        <div className="border border-destructive bg-destructive/10 p-4 text-destructive text-[13px]">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4" />
            <span>
              {reposQuery.error instanceof Error
                ? reposQuery.error.message
                : "Failed to load repositories"}
            </span>
          </div>
        </div>
      ) : (
        <div className="border border-border bg-background max-h-80 overflow-auto">
          <div className="divide-y divide-border">
            {filtered.map((repo) => {
              const checked = selected.has(repo.fullName);
              return (
                <label
                  key={repo.fullName}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-accent cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 rounded-[2px] border border-border bg-muted accent-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                  <span className="flex-1 truncate font-mono text-xs">
                    {repo.fullName}
                  </span>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-muted-foreground text-[13px]">
                No repositories match your filter.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          onClick={() => {
            const selectedRepos = entries.filter((repo) =>
              selected.has(repo.fullName),
            );
            onSave(selectedRepos);
          }}
          disabled={reposQuery.isLoading}
        >
          {saveLabel} ({selected.size})
        </Button>
      </div>
    </div>
  );
}
