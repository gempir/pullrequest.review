import { Store } from "@tanstack/store";
import { useSyncExternalStore } from "react";

export type ReviewPageUiState = {
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
        store.subscribe,
        () => selector(store.state),
        () => selector(store.state),
    );
}
