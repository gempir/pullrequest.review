# pullrequest.review

A lightweight Bitbucket and GitHub pull request review app with a terminal-inspired UI, focused on fast diff reading, file-tree navigation, and keyboard-driven workflows.

## Supported Hosts
- Bitbucket Cloud
- GitHub (`github.com`)

## URL Conventions
- Bitbucket PR route: `/$workspace/$repo/pull-requests/$pullRequestId`
- GitHub PR route: `/$workspace/$repo/pull/$pullRequestId`

## Authentication
- Bitbucket: email + API token.
- GitHub: fine-grained personal access token.
- GitHub public PRs can be opened without a token via the `/pull/` route (rate limited).
- GitHub write actions (approve/request changes/merge/comment) require a token.

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

## React Doctor

Run React Doctor locally with:

```bash
bun run react-doctor
```

For JSON output:

```bash
bun run react-doctor:json
```
