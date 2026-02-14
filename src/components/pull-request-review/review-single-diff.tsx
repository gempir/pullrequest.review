import type { PropsWithChildren } from "react";

export function ReviewSingleDiff({ children }: PropsWithChildren) {
  return (
    <div data-component="diff-file-view" className="h-full min-h-0 min-w-0">
      {children}
    </div>
  );
}
