import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { useMemo } from "react";
import { hideInlineCommentTrigger, showInlineCommentTrigger } from "@/features/review/components/inline-comment-trigger";
import { InlineDiffAnnotation } from "@/features/review/components/inline-diff-annotation";
import { useReview } from "@/features/review/components/review-context";
import type { ReviewFileDiffOptions, SingleFileAnnotation } from "@/features/review/model/review-page-model";

export function ReviewFileDiff({ filePath, fileDiff }: { filePath: string; fileDiff: FileDiffMetadata }) {
    const { model, diffOptions, diffTypographyStyle, canCommentInline, fileContextState, openInlineDraft, annotationProps } = useReview();
    const { buildFileAnnotations, toRenderableFileDiff } = model;
    const hasFullContext = fileContextState[filePath]?.status === "ready";
    const options = useMemo<ReviewFileDiffOptions>(
        () => ({
            ...diffOptions,
            hunkSeparators: hasFullContext ? "line-info" : "simple",
            onLineEnter: canCommentInline ? (props) => showInlineCommentTrigger(props, (target) => openInlineDraft(filePath, target)) : undefined,
            onLineLeave: canCommentInline ? hideInlineCommentTrigger : undefined,
        }),
        [canCommentInline, diffOptions, filePath, hasFullContext, openInlineDraft],
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
