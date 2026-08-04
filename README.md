# pullrequest.review

A lightweight Bitbucket and GitHub pull request review app with a terminal-inspired UI, focused on fast diff reading, file-tree navigation, and keyboard-driven workflows.

## Supported Hosts
- Bitbucket Cloud
- GitHub (`github.com`)

## URL Conventions
- Bitbucket PR route: `/$workspace/$repo/pull-requests/$pullRequestId`
- GitHub PR route: `/$workspace/$repo/pull/$pullRequestId`

## Authentication
- Bitbucket: OAuth 2.0 authorization code flow, or email + API token.
- GitHub: fine-grained personal access token.
- GitHub public PRs can be opened without a token via the `/pull/` route (rate limited).
- GitHub write actions (approve/request changes/merge/comment) require a token.

### Bitbucket OAuth configuration

Bitbucket OAuth uses a Cloudflare Worker only to start authorization and exchange or refresh tokens. Pull request, repository, and diff requests continue directly from the browser to `api.bitbucket.org`.

Configure each existing Bitbucket OAuth client with its matching callback URL:

```text
https://<app-origin>/oauth/callback
```

The client must use the authorization-code grant with refresh tokens and include Account read plus the repository and pull-request scopes the app needs.

For local development, copy `.dev.vars.example` to `.dev.vars` and fill it with the DEV client's values. The file is ignored by Git and is read by both Vite and Wrangler. Configure the DEV OAuth client's callback as `http://127.0.0.1:3000/oauth/callback`, then run `bun dev`. Vite serves the OAuth broker routes locally while retaining HMR.

To test the Cloudflare Worker runtime itself, build the app and run `bun run worker:dev`. Its callback must match the origin Wrangler prints, usually `http://localhost:8787/oauth/callback`.

For deployed environments, store both values as Cloudflare Worker secrets rather than committing them:

```bash
bunx wrangler secret put BITBUCKET_OAUTH_CLIENT_ID
bunx wrangler secret put BITBUCKET_OAUTH_CLIENT_SECRET
```

Build the SPA before starting the Worker locally:

```bash
bun run build
bun run worker:dev
```

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```
