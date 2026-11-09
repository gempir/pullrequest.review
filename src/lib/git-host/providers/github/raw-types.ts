export interface GithubUser {
    login: string;
    avatar_url?: string;
}

export interface GithubRepo {
    name: string;
    full_name: string;
    owner?: { login?: string };
}

export interface GithubPull {
    number: number;
    node_id?: string;
    title: string;
    state: string;
    html_url?: string;
    user?: { login?: string; avatar_url?: string };
    body?: string;
    body_text?: string;
    body_html?: string;
    draft?: boolean;
    created_at?: string;
    updated_at?: string;
    closed_at?: string;
    merged_at?: string;
    requested_reviewers?: Array<{ login?: string; avatar_url?: string }>;
    head?: {
        ref?: string;
        sha?: string;
        repo?: { full_name?: string };
    };
    base?: {
        ref?: string;
        sha?: string;
        repo?: { full_name?: string };
    };
}

export interface GithubFile {
    status?: string;
    filename?: string;
    previous_filename?: string;
    additions?: number;
    deletions?: number;
}

export interface GithubCommit {
    sha: string;
    commit?: {
        message?: string;
        author?: {
            date?: string;
            name?: string;
        };
    };
    author?: {
        login?: string;
        avatar_url?: string;
    };
}

export interface GithubIssueComment {
    id: number;
    created_at?: string;
    updated_at?: string;
    body?: string;
    body_text?: string;
    body_html?: string;
    user?: { login?: string; avatar_url?: string };
}

export interface GithubReviewComment {
    id: number;
    created_at?: string;
    updated_at?: string;
    body?: string;
    body_text?: string;
    body_html?: string;
    user?: { login?: string; avatar_url?: string };
    path?: string;
    line?: number | null;
    start_line?: number | null;
    original_line?: number | null;
    side?: "LEFT" | "RIGHT";
    start_side?: "LEFT" | "RIGHT";
    position?: number | null;
    in_reply_to_id?: number;
}

export interface GithubReview {
    id: number;
    state?: string;
    body?: string;
    body_text?: string;
    body_html?: string;
    user?: { login?: string; avatar_url?: string };
    submitted_at?: string;
}

export type GithubReviewThreadNode = {
    id?: string;
    isResolved?: boolean;
    comments?: {
        nodes?: Array<{
            databaseId?: number | null;
        }>;
    };
};

export interface GithubIssueEvent {
    id: number;
    event?: string;
    created_at?: string;
    actor?: { login?: string; avatar_url?: string };
    requested_reviewer?: { login?: string; avatar_url?: string };
}

export interface GithubCheckRun {
    id: number;
    name?: string;
    status?: string;
    conclusion?: string | null;
    html_url?: string;
    started_at?: string;
    completed_at?: string;
    app?: { name?: string };
}

export interface GithubCheckRunsResponse {
    check_runs?: GithubCheckRun[];
}

export interface GithubCommitStatus {
    id: number;
    context?: string;
    state?: string;
    target_url?: string;
    created_at?: string;
    updated_at?: string;
}

export interface GithubCombinedStatusResponse {
    statuses?: GithubCommitStatus[];
}

export interface GithubCompareResponse {
    files?: GithubFile[];
}
