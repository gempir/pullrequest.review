import { createContext, useContext, useState, type ReactNode } from "react";

interface BitbucketAuth {
  accessToken: string;
}

interface PrContextType {
  prUrl: string;
  setPrUrl: (url: string) => void;
  auth: BitbucketAuth | null;
  setAuth: (auth: BitbucketAuth | null) => void;
}

const PrContext = createContext<PrContextType | null>(null);

export function PrProvider({ children }: { children: ReactNode }) {
  const [prUrl, setPrUrl] = useState("");
  const [auth, setAuth] = useState<BitbucketAuth | null>(null);

  return (
    <PrContext.Provider value={{ prUrl, setPrUrl, auth, setAuth }}>
      {children}
    </PrContext.Provider>
  );
}

export function usePrContext() {
  const ctx = useContext(PrContext);
  if (!ctx) throw new Error("usePrContext must be used within PrProvider");
  return ctx;
}
