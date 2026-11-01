import type { DiffStatEntry, PullRequestDetails, PullRequestSummary } from "@/lib/git-host/types";

export interface BitbucketPullRequestPage {
    values: BitbucketPullRequestSummaryRaw[];
    next?: string;
}

export interface BitbucketPullRequestSummaryRaw {
    id: number;
    title: string;
    state: string;
    created_on?: string;
    updated_on?: string;
    source?: PullRequestSummary["source"];
    destination?: PullRequestSummary["destination"];
    links?: PullRequestSummary["links"];
    author?: BitbucketUser;
}

export interface BitbucketUser {
    account_id?: string;
    uuid?: string;
    nickname?: string;
    username?: string;
    display_name?: string;
    links?: { avatar?: { href?: string } };
}

export interface BitbucketPullRequestRaw {
    id: number;
    title: string;
    description?: string;
    state: string;
    draft?: boolean;
    comment_count?: number;
    task_count?: number;
    created_on?: string;
    updated_on?: string;
    closed_on?: string;
    author?: BitbucketUser;
    source?: PullRequestDetails["source"];
    destination?: PullRequestDetails["destination"];
    participants?: Array<{
        approved?: boolean;
        state?: string;
        user?: BitbucketUser;
    }>;
    reviewers?: BitbucketUser[];
    links?: PullRequestDetails["links"];
}

export interface BitbucketDiffStatPage {
    values: BitbucketDiffStatEntryRaw[];
    next?: string;
}

export interface BitbucketDiffStatEntryRaw {
    status: DiffStatEntry["status"];
    new?: { path?: string };
    old?: { path?: string };
    lines_added?: number;
    lines_removed?: number;
}

export interface BitbucketCommitRaw {
    hash: string;
    date?: string;
    message?: string;
    summary?: { raw?: string };
    author?: { user?: BitbucketUser; raw?: string };
}

export interface BitbucketCommitPage {
    values: BitbucketCommitRaw[];
    next?: string;
}

export interface BitbucketCommentRaw {
    id: number;
    created_on?: string;
    updated_on?: string;
    deleted?: boolean;
    pending?: boolean;
    content?: { raw?: string; html?: string };
    user?: BitbucketUser;
    inline?: { path?: string; to?: number; from?: number; start_to?: number; start_from?: number; outdated?: boolean };
    parent?: { id?: number };
    resolution?: { user?: BitbucketUser } | null;
    hostThreadId?: string;
}

export interface BitbucketCommentPage {
    values: BitbucketCommentRaw[];
    next?: string;
}

export interface BitbucketRepoEntry {
    name: string;
    full_name: string;
    slug: string;
    workspace?: { slug?: string };
}

export interface BitbucketRepoPage {
    values: BitbucketRepoEntry[];
    next?: string;
}

export interface BitbucketWorkspaceEntry {
    workspace?: { slug?: string };
}

export interface BitbucketWorkspacePage {
    values: BitbucketWorkspaceEntry[];
    next?: string;
}

export interface BitbucketActivityEntry {
    approval?: {
        date?: string;
        user?: BitbucketUser;
    };
    update?: {
        date?: string;
        author?: BitbucketUser;
        state?: string;
    };
}

export interface BitbucketActivityPage {
    values: BitbucketActivityEntry[];
    next?: string;
}

export interface BitbucketBuildStatus {
    key?: string;
    uuid?: string;
    name?: string;
    state?: string;
    url?: string;
    created_on?: string;
    updated_on?: string;
}

export interface BitbucketBuildStatusPage {
    values: BitbucketBuildStatus[];
    next?: string;
}
