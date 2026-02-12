import { createContext, type ReactNode, useContext, useState } from "react";

interface CommitContextType {
  commitUrl: string;
  setCommitUrl: (url: string) => void;
}

const CommitContext = createContext<CommitContextType | null>(null);

export function CommitProvider({ children }: { children: ReactNode }) {
  const [commitUrl, setCommitUrl] = useState("");
  return (
    <CommitContext.Provider value={{ commitUrl, setCommitUrl }}>
      {children}
    </CommitContext.Provider>
  );
}

export function useCommitUrl() {
  const ctx = useContext(CommitContext);
  if (!ctx) throw new Error("useCommitUrl must be used within CommitProvider");
  return ctx;
}
