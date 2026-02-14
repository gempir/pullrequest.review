import { createContext, type PropsWithChildren, useContext, useMemo } from "react";

export interface ReviewContextValue<State, Actions, Meta> {
    state: State;
    actions: Actions;
    meta: Meta;
}

function createReviewContext<State, Actions, Meta>() {
    const Context = createContext<ReviewContextValue<State, Actions, Meta> | null>(null);

    function Provider({ state, actions, meta, children }: PropsWithChildren<ReviewContextValue<State, Actions, Meta>>) {
        // Keep provider value stable when callers memoize state/actions/meta upstream.
        const value = useMemo(() => ({ state, actions, meta }), [state, actions, meta]);
        return <Context.Provider value={value}>{children}</Context.Provider>;
    }

    function useReviewContext() {
        const context = useContext(Context);
        if (!context) {
            throw new Error("Review context must be used inside its provider");
        }
        return context;
    }

    return { Provider, useReviewContext };
}

export const reviewContextFactory = { create: createReviewContext };
