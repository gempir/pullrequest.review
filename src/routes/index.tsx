import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCommitUrl } from "@/lib/commit-context";
import { useDiffOptions, toLibraryOptions } from "@/lib/diff-options-context";
import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";

const fetchPatch = createServerFn({
  method: "GET",
}).handler(async ({ data }: { data: string }) => {
  const url = data.trim();

  const commitUrlPattern =
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/commit\/[a-f0-9]+/;
  if (!commitUrlPattern.test(url)) {
    throw new Error("Invalid GitHub commit URL");
  }

  const patchUrl = url.endsWith(".patch") ? url : `${url}.patch`;
  const res = await fetch(patchUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch patch: ${res.status} ${res.statusText}`);
  }
  return res.text();
});

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { commitUrl } = useCommitUrl();
  const { options } = useDiffOptions();
  const libOptions = toLibraryOptions(options);

  const { data, isLoading, error } = useQuery({
    queryKey: ["patch", commitUrl],
    queryFn: () => fetchPatch({ data: commitUrl }),
    enabled: !!commitUrl,
  });

  if (!commitUrl) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground">
          Paste a GitHub commit URL in the sidebar and click Load Diff.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-muted-foreground">Loading patch...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-destructive">
          Error: {error instanceof Error ? error.message : "Failed to load patch"}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const patches = parsePatchFiles(data);
  const fileDiffs = patches.flatMap((p) => p.files);

  return (
    <div className="p-4 space-y-4">
      {fileDiffs.map((fileDiff, i) => (
        <FileDiff key={i} fileDiff={fileDiff} options={libOptions} />
      ))}
    </div>
  );
}
