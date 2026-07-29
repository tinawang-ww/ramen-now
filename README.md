# ramen now

A shared board for ramen shop queue lengths. One page, white background, nothing extra: see how many people are in line right now, tap once to report.

- Each report records only the *current number of people in line* — no wait-time estimates.
- Head counts are shown as person icons with the number beside them; above 10 people only 10 icons are drawn, so the number is the accurate part.
- Reports older than 90 minutes fade out, signalling they can no longer be read as "right now".
- Shops are added by users themselves; identical names (case-insensitive) are merged into the same shop.

Nuxt 4 + Nuxt UI v4 + Cloudflare Workers + D1 (Drizzle).

## Development

```sh
pnpm install
cp .env.example .env   # then put a real session password in it
pnpm db:migrate        # create the local D1 database (.wrangler/state)
pnpm dev
```

`NUXT_SESSION_PASSWORD` signs the session cookie and must be at least 32 characters: `openssl rand -base64 32`. `pnpm preview` reads it from `.dev.vars` instead, so copy `.dev.vars.example` too if you use that.

## Deployment

The `database_id` in `wrangler.jsonc` is a placeholder — create a real D1 database before your first deploy:

```sh
pnpm wrangler d1 create ramen-now   # copy the returned database_id back into wrangler.jsonc
pnpm db:migrate:remote
pnpm wrangler secret put NUXT_SESSION_PASSWORD
pnpm deploy
```

## Other commands

| Command | Purpose |
| --- | --- |
| `pnpm db:generate` | Generate a migration after editing `server/database/schema.ts` |
| `pnpm cf-typegen` | Regenerate `worker-configuration.d.ts` (after changing wrangler config) |
| `pnpm lint` / `pnpm typecheck` | Checks |
| `pnpm preview` | Run the built output with wrangler |
