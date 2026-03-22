import { Store } from "@tanstack/store";
import { useSyncExternalStore } from "react";

type ReviewPageUiState = {
    searchQuery: string;
    showUnviewedOnly: boolean;
    showSettingsPanel: boolean;
    mergeOpen: boolean;
    mergeMessage: string;
    mergeStrategy: string;
    closeSourceBranch: boolean;
    copiedPath: string | null;
    copiedSourceBranch: boolean;
};

export function createReviewPageUiStore() {
    return new Store<ReviewPageUiState>({
        searchQuery: "",
        showUnviewedOnly: false,
        showSettingsPanel: false,
        mergeOpen: false,
        mergeMessage: "",
        mergeStrategy: "merge_commit",
        closeSourceBranch: true,
        copiedPath: null,
        copiedSourceBranch: false,
    });
}

export function useReviewPageUiValue<T>(store: Store<ReviewPageUiState>, selector: (state: ReviewPageUiState) => T) {
    return useSyncExternalStore(
        (onStoreChange) => {
            const cleanup = store.subscribe(onStoreChange) as { unsubscribe?: () => void } | (() => void);
            if (typeof cleanup === "function") {
                return cleanup;
            }
            return () => {
                cleanup.unsubscribe?.();
            };
        },
        () => selector(store.state),
        () => selector(store.state),
    );
}
