import { useEffect, useMemo, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, FolderGit, Loader2, Search } from "lucide-react";
import type { BitbucketRepo } from "@/lib/bitbucket-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BitbucketRepoEntry {
  name: string;
  full_name: string;
  slug: string;
  workspace?: { slug?: string };
}

interface BitbucketRepoPage {
  values: BitbucketRepoEntry[];
  next?: string;
}

const fetchBitbucketRepos = createServerFn({
  method: "GET",
})
  .inputValidator((data: Record<string, never>) => data)
  .handler(async () => {
    const { requireBitbucketBasicAuthHeader } = await import(
      "@/lib/bitbucket-auth-cookie"
    );
    const authHeader = requireBitbucketBasicAuthHeader();

    const headers = {
      Authorization: authHeader,
      Accept: "application/json",
    };
    const values: BitbucketRepoEntry[] = [];
    let nextUrl: string | undefined =
      "https://api.bitbucket.org/2.0/repositories?role=member&pagelen=100";

    while (nextUrl) {
      const res = await fetch(nextUrl, { headers });
      if (!res.ok) {
        throw new Error(
          `Failed to fetch repositories: ${res.status} ${res.statusText}`,
        );
      }
      const page = (await res.json()) as BitbucketRepoPage;
      values.push(...(page.values ?? []));
      nextUrl = page.next;
    }

    return values;
  });

function toFullName(repo: BitbucketRepoEntry) {
  const fallbackName = `${repo.workspace?.slug ?? "unknown"}/${repo.slug}`;
  return repo.full_name ?? fallbackName;
}

function toSelectedRepo(repo: BitbucketRepoEntry): BitbucketRepo | null {
  const fullName = toFullName(repo);
  const workspace = repo.workspace?.slug ?? fullName.split("/")[0];
  if (!workspace || !repo.slug) return null;
  return {
    name: repo.name,
    fullName,
    slug: repo.slug,
    workspace,
  };
}

export function RepositorySelector({
  initialSelected,
  onSave,
  onCancel,
  saveLabel = "Save Repositories",
}: {
  initialSelected: BitbucketRepo[];
  onSave: (repos: BitbucketRepo[]) => void;
  onCancel?: () => void;
  saveLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const selectedKeys = useMemo(
    () => initialSelected.map((repo) => repo.fullName),
    [initialSelected],
  );

  useEffect(() => {
    setSelected(new Set(selectedKeys));
  }, [selectedKeys]);

  const reposQuery = useQuery({
    queryKey: ["bitbucket-repositories"],
    queryFn: () => fetchBitbucketRepos({ data: {} }),
  });

  const entries = reposQuery.data ?? [];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((repo) => {
      const fullName = repo.full_name?.toLowerCase() ?? "";
      const name = repo.name?.toLowerCase() ?? "";
      return fullName.includes(term) || name.includes(term);
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
              const fullName = toFullName(repo);
              const checked = selected.has(fullName);
              return (
                <label
                  key={fullName}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-accent cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    className="size-4 border border-input bg-background checked:bg-foreground checked:border-foreground"
                    checked={checked}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(fullName);
                        else next.delete(fullName);
                        return next;
                      });
                    }}
                  />
                  <span className="flex-1 truncate font-mono text-xs">
                    {fullName}
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
            const selectedRepos = entries
              .map((repo) => ({ entry: repo, fullName: toFullName(repo) }))
              .filter(({ fullName }) => selected.has(fullName))
              .map(({ entry }) => toSelectedRepo(entry))
              .filter((repo): repo is BitbucketRepo => Boolean(repo));
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
