import type { PropsWithChildren } from "react";

export function ReviewAllDiffs({ children }: PropsWithChildren) {
  return (
    <div data-component="diff-list-view" className="h-full min-h-0 min-w-0">
      {children}
    </div>
  );
}
