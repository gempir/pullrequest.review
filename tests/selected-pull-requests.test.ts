import { describe, expect, test } from "bun:test";
import type { PullRequestSummary, RepoRef } from "../src/lib/git-host/types";
import { buildPullRequestRows } from "../src/lib/selected-pull-requests";

const repo = (host: RepoRef["host"], fullName: string): RepoRef => {
    const [workspace = "", name = ""] = fullName.split("/");
    return { host, workspace, repo: name, fullName, displayName: name };
};
const pr = (id: number, updatedAt?: string): PullRequestSummary => ({ id, title: `#${id}`, state: "OPEN", updatedAt });

describe("selected repository pull request rows", () => {
    test("orders by last update, then newest id, then host and repository; undated rows last", () => {
        const rows = buildPullRequestRows([
            { repo: repo("github", "acme/web"), pullRequests: [pr(1, "2026-01-01T00:00:00Z"), pr(9)] },
            { repo: repo("bitbucket", "acme/api"), pullRequests: [pr(2, "2026-03-01T00:00:00Z"), pr(3, "2026-01-01T00:00:00Z")] },
            { repo: repo("bitbucket", "acme/web"), pullRequests: [pr(3, "2026-01-01T00:00:00Z")] },
        ]);

        expect(rows.map((row) => `${row.host}:${row.repo.fullName}#${row.pullRequest.id}`)).toEqual([
            "bitbucket:acme/api#2",
            "bitbucket:acme/api#3",
            "bitbucket:acme/web#3",
            "github:acme/web#1",
            "github:acme/web#9",
        ]);
    });
});
