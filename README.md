# Family Ledger

A Next.js App Router (TypeScript) app for manually tracking funeral contributions received via personal M-Pesa and generating a WhatsApp-ready update message for a family group.

## Features

- Admin login with password from `ADMIN_PASSWORD`
- httpOnly cookie session
- Manual contribution entry (name, amount, ref, timestamp, note)
- Duplicate prevention by M-Pesa reference
- Duplicate warning for same name + amount within 10 minutes when no ref is provided
- Dashboard totals + WhatsApp update generator
- Update cutoff tracking (`new since last update`)
- Repository abstraction with:
  - `InMemoryRepository` (default)
  - `PrismaRepository` (feature-flagged with `USE_DB=true`)
- Local JSON persistence in development (no live DB required)

## Quick Start (No Database)

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Set at least:

```env
ADMIN_PASSWORD=your-strong-password
USE_DB=false
```

4. Run the app:

```bash
npm run dev
```

5. Open [http://localhost:3000/login](http://localhost:3000/login)

## Routes

- `/login` - admin login
- `/` - dashboard totals + WhatsApp message generator
- `/contributions` - add/list/delete contributions

## Data Storage (Default)

When `USE_DB=false`, the app uses an in-memory repository and persists to a local JSON file during development:

- `data/family-ledger.dev.json`

This lets you build/test the flow without Neon, Prisma, or migrations.

## Production Deployment (Vercel)

Important: `USE_DB=false` is for local development only. The in-memory/local JSON store is not reliable on Vercel/serverless because filesystem writes are ephemeral and instances are stateless.

Use `USE_DB=true` with Neon + Prisma for deployment.

### 1. Push the project to GitHub

Push `/Users/jimkar/Desktop/projects/family-ledger` to a repository.

Before the first deploy, create and commit the initial Prisma migration locally:

```bash
npx prisma migrate dev --name init_family_ledger
```

Commit the generated `prisma/migrations` folder.

### 2. Import to Vercel

- Create a new project in Vercel
- Select your repository
- If the repo contains multiple projects, set **Root Directory** to `family-ledger`

### 3. Set Environment Variables (Vercel Project Settings)

Required:

```env
ADMIN_PASSWORD=your-strong-password
SESSION_SECRET=use-a-different-long-random-secret
USE_DB=true
DATABASE_URL=postgresql://...pooled-neon-url...?sslmode=require
DIRECT_URL=postgresql://...unpooled-neon-url...?sslmode=require
```

Notes:

- `DATABASE_URL` should be the Neon pooled connection (pooler host)
- `DIRECT_URL` should be the Neon non-pooled/unpooled connection (used for migrations)

### 4. Configure Build Command in Vercel

Set the build command to:

```bash
npm run build:vercel
```

This runs:

- `prisma generate`
- `prisma migrate deploy`
- `next build`

### 5. Deploy

Deploy from Vercel. After deployment:

- Open `/login`
- Sign in with `ADMIN_PASSWORD`
- Add a test contribution
- Generate a WhatsApp update

### 6. Redeploys / schema changes

When you change the Prisma schema:

1. Run a migration locally
2. Commit the new migration files
3. Redeploy (Vercel runs `prisma migrate deploy` during build)

## Enable Neon + Prisma Later

1. Install Prisma packages:

```bash
npm install @prisma/client
npm install -D prisma
npm install @prisma/adapter-pg pg dotenv
```

2. Add env variables (`.env.local`):

```env
ADMIN_PASSWORD=your-strong-password
USE_DB=true
DATABASE_URL=postgresql://USER:PASSWORD@HOST/db?sslmode=require
DIRECT_URL=postgresql://USER:PASSWORD@HOST/db?sslmode=require
```

Prisma 7 note:

- This project uses `prisma.config.ts` for CLI connection config (migrations/generate)
- `DIRECT_URL` is preferred for Prisma CLI commands
- Runtime queries use `DATABASE_URL` through the Prisma PostgreSQL adapter

3. Create and apply migration:

```bash
npx prisma migrate dev --name init_family_ledger
```

4. Generate Prisma client (usually done automatically, but safe to run):

```bash
npx prisma generate
```

5. Restart the app:

```bash
npm run dev
```

## Notes

- No real secrets are included in this project. Use placeholders in env files and set your own values locally.
- The Prisma repository is only used when `USE_DB=true`.
- If `USE_DB=true` but Prisma is not installed/generated, the app throws a descriptive error.
- For production on Vercel, set `SESSION_SECRET` explicitly (do not rely on the fallback).
