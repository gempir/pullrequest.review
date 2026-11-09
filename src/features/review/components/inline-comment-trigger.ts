import type { OnDiffLineEnterLeaveProps } from "@pierre/diffs";
import type { InlineCommentLineTarget } from "@/features/review/model/review-page-model";

// The diff renders outside React, so the hover "add comment" button is plain DOM attached to the line number cell.
const TRIGGER_ATTR = "data-inline-comment-trigger";
const TRIGGER_LABEL = "Add line comment";
const PLUS_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';

export function hideInlineCommentTrigger(props: OnDiffLineEnterLeaveProps) {
    props.lineElement.style.cursor = "";
    if (!props.numberElement) return;
    props.numberElement.style.cursor = "";
    props.numberElement.querySelector(`[${TRIGGER_ATTR}="true"]`)?.remove();
}

export function showInlineCommentTrigger(props: OnDiffLineEnterLeaveProps, onOpen: (target: InlineCommentLineTarget) => void) {
    hideInlineCommentTrigger(props);
    const numberElement = props.numberElement;
    if (!numberElement) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-flex h-4 w-4 items-center justify-center rounded border border-status-added/80 bg-status-added/20 text-status-added shadow-sm";
    button.title = TRIGGER_LABEL;
    button.setAttribute("aria-label", TRIGGER_LABEL);
    button.setAttribute(TRIGGER_ATTR, "true");
    button.setAttribute("data-inline-comment-trigger-id", `${props.annotationSide}:${props.lineNumber}`);
    button.innerHTML = PLUS_ICON;
    Object.assign(button.style, { position: "absolute", right: "2px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", zIndex: "2" });
    button.onpointerdown = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };
    button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen({ lineNumber: props.lineNumber, annotationSide: props.annotationSide });
    };
    numberElement.style.position = "relative";
    numberElement.style.cursor = "pointer";
    numberElement.appendChild(button);
}
