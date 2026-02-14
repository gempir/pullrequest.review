import { useCallback } from "react";

export function usePathNavigator({ activePath, onSelect }: { activePath?: string; onSelect: (path: string) => void }) {
    const selectFromPaths = useCallback(
        (paths: string[], direction: "next" | "previous") => {
            if (paths.length === 0) return;

            if (!activePath) {
                onSelect(direction === "next" ? paths[0] : paths[paths.length - 1]);
                return;
            }

            const currentIndex = paths.indexOf(activePath);
            if (currentIndex === -1) {
                onSelect(direction === "next" ? paths[0] : paths[paths.length - 1]);
                return;
            }

            const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
            if (nextIndex < 0 || nextIndex >= paths.length) return;
            onSelect(paths[nextIndex]);
        },
        [activePath, onSelect],
    );

    return { selectFromPaths };
}
