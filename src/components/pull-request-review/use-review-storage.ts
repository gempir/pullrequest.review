import { useMemo } from "react";
import type { GitHost } from "@/lib/git-host/types";
import {
  makeVersionedStorageKey,
  readMigratedLocalStorage,
  writeLocalStorageValue,
} from "@/lib/storage/versioned-local-storage";

const VIEWED_STORAGE_PREFIX_BASE = "pr_review_viewed";
const VIEWED_STORAGE_PREFIX = makeVersionedStorageKey(
  VIEWED_STORAGE_PREFIX_BASE,
  2,
);

export function useViewedStorageKey(data?: {
  host: GitHost;
  workspace: string;
  repo: string;
  pullRequestId: string;
}) {
  const host = data?.host;
  const workspace = data?.workspace;
  const repo = data?.repo;
  const pullRequestId = data?.pullRequestId;

  return useMemo(() => {
    if (!host || !workspace || !repo || !pullRequestId) return "";
    return `${VIEWED_STORAGE_PREFIX}:${host}:${workspace}/${repo}/${pullRequestId}`;
  }, [host, pullRequestId, repo, workspace]);
}

export function readViewedFiles(storageKey: string, legacyKeys: string[] = []) {
  if (!storageKey || typeof window === "undefined") return new Set<string>();
  try {
    const legacyV1Key = storageKey.replace(
      `${VIEWED_STORAGE_PREFIX}:`,
      `${VIEWED_STORAGE_PREFIX_BASE}:`,
    );
    const raw =
      window.localStorage.getItem(storageKey) ??
      window.localStorage.getItem(legacyV1Key) ??
      legacyKeys.map((key) => window.localStorage.getItem(key)).find(Boolean) ??
      null;

    if (!raw) return new Set<string>();

    const parsed = JSON.parse(raw) as string[];
    if (!window.localStorage.getItem(storageKey)) {
      writeLocalStorageValue(storageKey, raw);
    }
    return new Set(parsed);
  } catch {
    return new Set<string>();
  }
}

export function writeViewedFiles(storageKey: string, viewedFiles: Set<string>) {
  if (!storageKey) return;
  writeLocalStorageValue(storageKey, JSON.stringify(Array.from(viewedFiles)));
}

export function readMigratedValue(
  currentKey: string,
  legacyKeys: string[] = [],
) {
  return readMigratedLocalStorage(currentKey, legacyKeys);
}
