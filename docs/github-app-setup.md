# GitHub App Setup

RepoPulse V0.6 uses a GitHub App for webhook-driven automatic refresh and installation-token API access.

Private repository support in V0.6 is intended for single-owner or self-hosted deployments, not a public multi-tenant SaaS.

## Create the App

1. Open GitHub Developer settings and create a new GitHub App.
2. Set the webhook URL to your HTTPS tunnel endpoint:

   ```text
   https://<your-tunnel>/api/webhooks/github
   ```

3. Generate a strong webhook secret and set it in both GitHub and `.env`:

   ```env
   GITHUB_WEBHOOK_SECRET=your_webhook_secret
   ```

4. After creation, copy the App ID:

   ```env
   GITHUB_APP_ID=123456
   ```

5. Set the app slug used for install links:

   ```env
   GITHUB_APP_SLUG=your-repopulse-app-slug
   ```

## Private Key

Generate a private key in the GitHub App settings. Configure one of:

```env
GITHUB_APP_PRIVATE_KEY_PATH=D:\path\to\github-app.private-key.pem
```

or:

```env
GITHUB_APP_PRIVATE_KEY_BASE64=base64_encoded_pem
```

Do not commit the private key, `.env`, webhook secret or generated installation tokens.

## Permissions

Use the minimum permissions needed for repository analysis:

```text
Metadata: Read-only
Contents: Read-only
Pull requests: Read-only
Issues: Read-only
Actions: Read-only
```

## Events

Subscribe only to the V0.6 supported events:

```text
installation
installation_repositories
push
pull_request
```

Unsupported events are marked `IGNORED` by the webhook worker and do not create analysis tasks.

## Local HTTPS Tunnel

Run the API locally:

```bash
npm run dev:api
```

Expose it through an HTTPS tunnel such as ngrok, Cloudflare Tunnel or another trusted tunnel:

```text
https://<your-tunnel>/api/webhooks/github -> http://localhost:3001/api/webhooks/github
```

GitHub requires HTTPS for webhook delivery.

## Install the App

Install the app on `Chikachi00/RepoPulse-GitHub` or another repository you control. RepoPulse stores:

- installation status
- account login and type
- repository selection
- repository mappings
- minimal permissions and subscribed events

RepoPulse does not store installation tokens.

## Verify Webhook Delivery

1. Start PostgreSQL, API, Worker and Web:

   ```bash
   npm run dev:services
   npm run db:migrate:deploy
   npm run dev:api
   npm run dev:worker
   npm run dev:web
   ```

2. Install the GitHub App.
3. Confirm GitHub shows a successful `installation` delivery.
4. Confirm the database has a `GitHubInstallation` row and active `GitHubInstallationRepository` mapping.
5. Push to the repository default branch or open/synchronize a pull request.
6. Confirm the webhook delivery becomes `PROCESSED`.
7. Confirm a `WEBHOOK` / `FULL` `AnalysisRun` is queued.
8. Confirm the analysis worker completes the run and creates a new historical snapshot.

If the app is suspended, automatic refresh pauses. If the app is deleted, mappings are marked inactive but historical reports remain.
