import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const EMOJI_ALT_PATTERN = /^:[^\s:]+:$/;
const EMOJI_URL_PATTERN = /(?:^|[/_.-])emoji(?:s)?(?:[/_.-]|$)/i;

function hasEmojiClass(className?: string) {
    return className?.split(/\s+/).some((name) => name.toLowerCase() === "emoji") ?? false;
}

function hasSmallIntrinsicSize(width: ComponentProps<"img">["width"], height: ComponentProps<"img">["height"]) {
    const numericWidth = typeof width === "number" ? width : Number(width);
    const numericHeight = typeof height === "number" ? height : Number(height);
    return (
        Number.isFinite(numericWidth) && Number.isFinite(numericHeight) && numericWidth > 0 && numericWidth <= 32 && numericHeight > 0 && numericHeight <= 32
    );
}

function isCommentEmojiImage({ alt, className, height, src, width }: ComponentProps<"img">) {
    return hasEmojiClass(className) || EMOJI_ALT_PATTERN.test(alt ?? "") || EMOJI_URL_PATTERN.test(src ?? "") || hasSmallIntrinsicSize(width, height);
}

export function CommentMarkdownImage({ className, ...props }: ComponentProps<"img">) {
    const isEmoji = isCommentEmojiImage({ className, ...props });
    return (
        <img
            {...props}
            className={cn("inline align-middle", isEmoji ? "size-[1.25em] object-contain" : "h-auto max-w-full", className)}
            alt={props.alt ?? ""}
        />
    );
}
