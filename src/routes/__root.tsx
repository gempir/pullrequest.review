/// <reference types="vite/client" />
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommitProvider, useCommitUrl } from "@/lib/commit-context";
import { DiffOptionsProvider } from "@/lib/diff-options-context";
import { FileTreeProvider } from "@/lib/file-tree-context";
import { DiffToolbar } from "@/components/diff-toolbar";
import { FileTree } from "@/components/file-tree";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

import appCss from "../../styles.css?url";

const queryClient = new QueryClient();

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PR Review" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 antialiased">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">404</h1>
        <p className="text-muted-foreground">Page not found.</p>
        <Link
          to="/"
          className="inline-block px-4 py-2 bg-foreground text-background rounded-lg font-medium hover:opacity-90 transition-opacity text-sm"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

function RootComponent() {
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <CommitProvider>
          <DiffOptionsProvider>
            <FileTreeProvider>
              <AppLayout />
            </FileTreeProvider>
          </DiffOptionsProvider>
        </CommitProvider>
      </QueryClientProvider>
    </RootDocument>
  );
}

function CommitInput() {
  const { setCommitUrl } = useCommitUrl();
  const [inputValue, setInputValue] = useState("");

  const handleLoad = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setCommitUrl(trimmed);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="https://github.com/user/repo/commit/sha"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleLoad()}
        className="h-7 text-xs w-80"
      />
      <Button onClick={handleLoad} size="sm" className="h-7 text-xs px-3">
        Load
      </Button>
    </div>
  );
}

function AppLayout() {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-4 border-b px-4 py-2 shrink-0">
        <h1 className="text-sm font-semibold tracking-tight whitespace-nowrap">PR Review</h1>
        <CommitInput />
        <DiffToolbar />
      </header>
      <div className="flex flex-1 min-h-0">
        <aside className="w-64 shrink-0 border-r">
          <ScrollArea className="h-full">
            <div className="p-2">
              <FileTree path="" />
            </div>
          </ScrollArea>
        </aside>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
