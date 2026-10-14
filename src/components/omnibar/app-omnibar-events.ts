const openListeners = new Set<() => void>();

export function requestOpenAppPullRequestOmnibar() {
    for (const listener of openListeners) {
        listener();
    }
}

export function subscribeAppPullRequestOmnibarOpen(listener: () => void) {
    openListeners.add(listener);
    return () => {
        openListeners.delete(listener);
    };
}
