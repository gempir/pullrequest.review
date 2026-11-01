import type { FileDiffMetadata } from "@pierre/diffs/react";
import { RepositoryFileIcon } from "@/components/repository-file-icon";
import { DiffContextButton } from "@/features/review/components/diff-context-button";
import { useReview } from "@/features/review/components/review-context";
import { ReviewDiffSettingsMenu } from "@/features/review/components/review-diff-settings-menu";
import { CopyPathButton, ViewedToggle } from "@/features/review/components/review-file-controls";

function splitPath(path: string) {
    const separatorIndex = path.lastIndexOf("/");
    if (separatorIndex === -1) return { directory: "", fileName: path };
    return { directory: path.slice(0, separatorIndex + 1), fileName: path.slice(separatorIndex + 1) };
}

export function ReviewFileHeader({
    filePath,
    fileDiff,
    unresolvedCount = 0,
    onToggleCollapsed,
}: {
    filePath: string;
    fileDiff: FileDiffMetadata;
    unresolvedCount?: number;
    onToggleCollapsed?: () => void;
}) {
    const { model, viewMode, setViewMode, openDiffSettings, fileContextState, onLoadFullFileContext } = useReview();
    const stats = model.fileLineStats.get(filePath);
    const { directory, fileName } = splitPath(filePath);
    const title = (
        <>
            <RepositoryFileIcon fileName={fileName} className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate text-[13px]" title={filePath}>
                <span className="text-faint-foreground">{directory}</span>
                <span className="font-semibold text-foreground">{fileName}</span>
            </span>
        </>
    );

    return (
        <div className="canvas-sticky-header glass-strong flex h-11 min-w-0 items-center gap-2 overflow-hidden rounded-[15px] border-0 pl-3.5 pr-2.5 shadow-none">
            {onToggleCollapsed ? (
                <button type="button" className="flex h-full min-w-0 items-center gap-2 text-left" onClick={onToggleCollapsed}>
                    {title}
                </button>
            ) : (
                <div className="flex min-w-0 items-center gap-2">{title}</div>
            )}
            <CopyPathButton path={filePath} />
            <DiffContextButton state={fileContextState[filePath]} onClick={() => onLoadFullFileContext(filePath, fileDiff)} />
            <div className="ml-auto flex shrink-0 items-center gap-2 text-[12px] font-medium tabular-nums">
                {unresolvedCount > 0 ? <span className="font-normal text-muted-foreground">{unresolvedCount} unresolved</span> : null}
                <span className="select-none text-status-added">+{stats?.added ?? 0}</span>
                <span className="select-none text-status-removed">-{stats?.removed ?? 0}</span>
                <ReviewDiffSettingsMenu viewMode={viewMode} onViewModeChange={setViewMode} onOpenDiffSettings={openDiffSettings} />
                <ViewedToggle path={filePath} />
            </div>
        </div>
    );
}
