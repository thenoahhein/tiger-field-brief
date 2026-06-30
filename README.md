# Tiger Field Brief 🐅

A lightweight internal tool that collects raw GTM signal for TigerData's
time-series business and turns it into a **daily field intelligence brief** —
customer pain, sales objections, competitor mentions, docs gaps, product
confusion, and recommended PMM actions.

Paste raw notes, optionally add metadata, click **Generate Brief**, and the app
sends the notes to an LLM, extracts structured GTM signals, generates a brief,
and saves everything to Postgres so you can browse and search later.

## Stack

- **TanStack Start** (React + TypeScript) — file-based routing + server functions
- **Tailwind CSS v4** — styling
- **Postgres** + **Prisma** — database & ORM
- **Zod** — strict validation of LLM output before anything is saved
- **Anthropic (Claude)** by default, or **OpenAI** — LLM provider (configurable)

## Pages

| Route         | Purpose                                                        |
| ------------- | ------------------------------------------------------------- |
| `/`           | Landing page with links to New Brief / Briefs / Signals       |
| `/new`        | Form to paste raw notes + metadata and generate a brief       |
| `/briefs`     | Saved briefs, reverse-chronological                           |
| `/briefs/:id` | Full brief, the raw notes used, and extracted signals         |
| `/signals`    | Table of all extracted signals with filters + search          |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start Postgres

Any Postgres 14+ works. The quickest local option is Docker:

```bash
docker run -d --name tfb-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=tiger_field_brief \
  -p 5432:5432 postgres:16
```

### 3. Configure environment

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

> **Note:** this is a Vite/TanStack app, so it uses `.env` (the Vite/Prisma
> convention) rather than Next.js's `.env.local`. Both `.env` and `*.local`
> files are git-ignored.

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tiger_field_brief?schema=public"

# "anthropic" (default) or "openai"
LLM_PROVIDER="anthropic"

# Anthropic (Claude)
ANTHROPIC_API_KEY="sk-ant-..."
# ANTHROPIC_MODEL="claude-3-5-sonnet-latest"

# OpenAI (only needed if LLM_PROVIDER=openai)
# OPENAI_API_KEY="sk-..."
# OPENAI_MODEL="gpt-4o-mini"
```

The API key is only ever read in server functions (`src/server/*`) and is never
exposed to the client.

### 4. Run migrations

```bash
npx prisma migrate dev
```

### 5. Start the dev server

```bash
npm run dev
```

Open http://localhost:3000.

## How it works

1. `/new` posts the raw notes + metadata to the `generateBrief` server function.
2. `generateFieldBrief(rawNote, metadata)` (`src/server/llm.ts`) calls the LLM
   with a fixed TigerData GTM prompt.
3. The response is parsed and validated with **Zod** (`src/server/schema.ts`).
   If the LLM returns invalid JSON or the wrong shape, a clear error is shown
   and **nothing is saved**.
4. On success the raw note, brief, and signals are written to Postgres in a
   single transaction, and you're redirected to the brief.

## Project layout

```
prisma/schema.prisma      # RawNote, Signal, Brief models
src/server/db.ts          # Prisma client singleton
src/server/schema.ts      # Zod schemas (input + LLM output)
src/server/llm.ts         # generateFieldBrief() — LLM call + validation
src/server/briefs.ts      # server functions: generate / list / get / filter
src/routes/index.tsx      # /
src/routes/new.tsx        # /new
src/routes/briefs/        # /briefs and /briefs/$id
src/routes/signals.tsx    # /signals
```

## Useful commands

```bash
npm run dev          # start dev server on :3000
npm run build        # production build
npx tsc --noEmit     # typecheck
npx prisma studio    # browse the database
```
