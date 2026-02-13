export type GitHost = "bitbucket" | "github";

export interface RepoRef {
  host: GitHost;
  workspace: string;
  repo: string;
  fullName: string;
  displayName: string;
}

export interface PullRequestRef {
  host: GitHost;
  workspace: string;
  repo: string;
  pullRequestId: string;
}

export interface DiffStatEntry {
  status: "added" | "modified" | "removed" | "renamed";
  new?: { path?: string };
  old?: { path?: string };
  lines_added?: number;
  lines_removed?: number;
}

export interface PullRequestSummary {
  id: number;
  title: string;
  state: string;
  links?: { html?: { href?: string } };
  author?: { display_name?: string; avatar_url?: string };
}

export interface Commit {
  hash: string;
  date?: string;
  message?: string;
  summary?: { raw?: string };
  author?: { user?: { display_name?: string; avatar_url?: string }; raw?: string };
}

export interface Comment {
  id: number;
  created_on?: string;
  updated_on?: string;
  deleted?: boolean;
  pending?: boolean;
  content?: { raw?: string; html?: string };
  user?: { display_name?: string; avatar_url?: string };
  inline?: { path?: string; to?: number; from?: number };
  parent?: { id?: number };
  resolution?: { user?: { display_name?: string; avatar_url?: string } } | null;
  hostThreadId?: string;
}

export interface PullRequestDetails {
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
  merged_on?: string;
  author?: { display_name?: string; avatar_url?: string };
  source?: {
    branch?: { name?: string };
    repository?: { full_name?: string };
  };
  destination?: {
    branch?: { name?: string };
    repository?: { full_name?: string };
  };
  participants?: Array<{
    approved?: boolean;
    user?: { display_name?: string; avatar_url?: string };
  }>;
  links?: { html?: { href?: string } };
}

export type PullRequestHistoryEventType =
  | "comment"
  | "approved"
  | "changes_requested"
  | "review_requested"
  | "review_dismissed"
  | "reviewer_added"
  | "reviewer_removed"
  | "opened"
  | "updated"
  | "closed"
  | "merged"
  | "reopened";

export interface PullRequestHistoryEvent {
  id: string;
  type: PullRequestHistoryEventType;
  created_on?: string;
  actor?: { display_name?: string; avatar_url?: string };
  content?: string;
  details?: string;
}

export type PullRequestReviewerStatus =
  | "approved"
  | "changes_requested"
  | "commented"
  | "pending";

export interface PullRequestReviewer {
  id: string;
  display_name?: string;
  avatar_url?: string;
  status: PullRequestReviewerStatus;
  approved: boolean;
  requested?: boolean;
  updated_on?: string;
}

export type PullRequestBuildState =
  | "success"
  | "failed"
  | "pending"
  | "skipped"
  | "neutral"
  | "unknown";

export interface PullRequestBuildStatus {
  id: string;
  name: string;
  state: PullRequestBuildState;
  url?: string;
  provider?: string;
  started_on?: string;
  completed_on?: string;
}

export interface PullRequestBundle {
  prRef: PullRequestRef;
  pr: PullRequestDetails;
  diff: string;
  diffstat: DiffStatEntry[];
  commits: Commit[];
  comments: Comment[];
  history?: PullRequestHistoryEvent[];
  reviewers?: PullRequestReviewer[];
  buildStatuses?: PullRequestBuildStatus[];
}

export interface MergeOptions {
  closeSourceBranch?: boolean;
  message?: string;
  mergeStrategy?: string;
}

export interface CommentPayload {
  content: string;
  inline?: { path: string; to?: number; from?: number };
  parentId?: number;
}

export interface HostCapabilities {
  supportsThreadResolution: boolean;
  mergeStrategies?: string[];
  requestChangesAvailable: boolean;
}

export interface HostApiErrorDetails {
  status?: number;
  statusText?: string;
  body?: string;
}

export class HostApiError extends Error {
  status?: number;
  statusText?: string;
  body?: string;

  constructor(message: string, details: HostApiErrorDetails = {}) {
    super(message);
    this.name = "HostApiError";
    this.status = details.status;
    this.statusText = details.statusText;
    this.body = details.body;
  }
}

export interface AuthState {
  authenticated: boolean;
}

export type LoginCredentials =
  | { host: "bitbucket"; email: string; apiToken: string }
  | { host: "github"; token: string };

export interface GitHostClient {
  readonly host: GitHost;
  readonly capabilities: HostCapabilities;
  getAuthState(): Promise<AuthState>;
  login(credentials: LoginCredentials): Promise<AuthState>;
  logout(): Promise<AuthState>;
  listRepositories(): Promise<RepoRef[]>;
  listPullRequestsForRepos(data: {
    repos: RepoRef[];
  }): Promise<Array<{ repo: RepoRef; pullRequests: PullRequestSummary[] }>>;
  fetchPullRequestBundleByRef(data: {
    prRef: PullRequestRef;
  }): Promise<PullRequestBundle>;
  approvePullRequest(data: { prRef: PullRequestRef }): Promise<{ ok: true }>;
  requestChanges(data: {
    prRef: PullRequestRef;
    body?: string;
  }): Promise<{ ok: true }>;
  mergePullRequest(
    data: { prRef: PullRequestRef } & MergeOptions,
  ): Promise<{ ok: true }>;
  createPullRequestComment(
    data: {
      prRef: PullRequestRef;
    } & CommentPayload,
  ): Promise<{ ok: true }>;
  resolvePullRequestComment(data: {
    prRef: PullRequestRef;
    commentId: number;
    resolve: boolean;
  }): Promise<{ ok: true }>;
}
