import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { useMemo } from "react";
import { InlineDiffAnnotation } from "@/features/review/components/inline-diff-annotation";
import { useReview } from "@/features/review/components/review-context";
import type { ReviewFileDiffOptions } from "@/features/review/hooks/use-review-diff-model";
import type { SingleFileAnnotation } from "@/features/review/model/review-page-model";

export function ReviewFileDiff({ filePath, fileDiff }: { filePath: string; fileDiff: FileDiffMetadata }) {
    const { model, diffOptions, diffTypographyStyle, canCommentInline, fileContextState, openInlineDraft, annotationProps } = useReview();
    const { handleDiffLineEnter, handleDiffLineLeave, buildFileAnnotations, toRenderableFileDiff } = model;
    const hasFullContext = fileContextState[filePath]?.status === "ready";
    const options = useMemo<ReviewFileDiffOptions>(
        () => ({
            ...diffOptions,
            hunkSeparators: hasFullContext ? "line-info" : "simple",
            onLineEnter: canCommentInline ? (props) => handleDiffLineEnter(props, (target) => openInlineDraft(filePath, target)) : undefined,
            onLineLeave: canCommentInline ? handleDiffLineLeave : undefined,
        }),
        [canCommentInline, diffOptions, filePath, handleDiffLineEnter, handleDiffLineLeave, hasFullContext, openInlineDraft],
    );
    const annotations = useMemo(() => buildFileAnnotations(filePath), [buildFileAnnotations, filePath]);
    const renderableDiff = useMemo(() => toRenderableFileDiff(fileDiff), [fileDiff, toRenderableFileDiff]);

    return (
        <FileDiff
            key={`${filePath}:${hasFullContext ? "full-context" : "patch-context"}`}
            fileDiff={renderableDiff}
            options={options}
            className="compact-diff commentable-diff pr-diff-font"
            style={diffTypographyStyle}
            lineAnnotations={annotations}
            renderAnnotation={(annotation) => <InlineDiffAnnotation annotation={annotation as SingleFileAnnotation} {...annotationProps} />}
        />
    );
}
