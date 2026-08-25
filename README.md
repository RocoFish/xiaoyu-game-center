# 🏀 Fish Game Center

<p align="center">
  [English](README.md) | [中文](README.zh-CN.md)
</p>

Visit ：https://xiaoyu-game-center-djqlq46tc-rf-3265.vercel.app/

A deployable online mini-game website.

- **Basketball Challenge**: 60-second timed shooting with three difficulties (Easy / Normal / Hard), drag-to-aim, physics-based ball trajectory, backboard/rim collisions, and combo feedback (SWISH! +2, 🔥 N in a row).
- **Accounts**: Supabase Auth sign-up / login / logout, with username and avatar settings.
- **Leaderboard**: Today / This week / All-time tabs, showing rank, avatar, username, score, accuracy, difficulty, and date; logged-in users can see their own rank.
- **Profile**: Best score, total games played, best accuracy, best combo, recent records, plus a full "My Scores" list.
- **Dark / light theme**: dark by default (black + basketball orange), with one-click switching.
- **Responsive**: fully adapted for phone / tablet / desktop, with both touch and mouse support.

## Tech Stack

- [Next.js](https://nextjs.org/) (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Supabase](https://supabase.com/) (Auth + PostgreSQL + Storage)
- Deploy: [Vercel](https://vercel.com/) + GitHub

## Project Structure

```
src/
  app/               Pages and API routes (home / login / register / games / leaderboard / profile / scores)
    api/             Server endpoints (issue game tokens, submit & validate scores)
  games/             Game modules (registry.ts registry + basketball/ Basketball Challenge)
  components/        Shared UI (nav / cards / forms / leaderboard / theme toggle, etc.)
  hooks/             useAuth / useLeaderboard / usePlayerStats
  lib/               Supabase client, anti-cheat validation, utility functions
  types/             Shared types
supabase/migrations/ Database init SQL (tables + RLS + triggers + storage buckets)
```

**Adding a new game**: create a folder under `src/games/`, implement the game, register its metadata in `src/games/registry.ts`, then load the component with `dynamic()` on the page — no changes to the homepage, navigation, or leaderboard are needed.

## Local Development

Requires Node.js 18.18+ (20+ recommended).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (see "Environment Variables" below)
cp .env.example .env.local

# 3. Start the dev server
npm run dev
```

Open http://localhost:3000 .

## Configure Supabase

1. Create a project at [supabase.com](https://supabase.com) (the free tier is fine).
2. Open **SQL Editor**, paste and run the full contents of `supabase/migrations/0001_init.sql` (this creates the `profiles` and `game_scores` tables, indexes, RLS policies, sign-up triggers, and the `avatars` storage bucket).
3. In **Project Settings → API**, copy the `Project URL` and the `anon public` key, and fill them into the environment variables.
4. (Optional) To disable email confirmation so users are logged in right after signing up: **Authentication → Providers → Email**, turn off "Confirm email".

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (publicly safe) |
| `ANTI_CHEAT_SECRET` | Server-side anti-cheat signing secret, any long random string |
| `SUPABASE_SERVICE_ROLE_KEY` (optional) | Service role key, server-only, never expose it |

> `.env.local` is in `.gitignore` and is never committed. `NEXT_PUBLIC_*` variables end up in the frontend bundle (the anon key is designed to be public); everything else stays server-side.

## Security Design

- **RLS (Row Level Security)**: both `game_scores` and `profiles` enable RLS — the leaderboard is publicly read-only; users can only write scores where `user_id = auth.uid()` and only modify/delete their own profile.
- **Server-side anti-cheat** (`src/lib/anti-cheat.ts` + `src/app/api/scores/route.ts`):
  1. The client-submitted `score` is not trusted; the server recomputes it from `made_shots`;
  2. On game start, the server issues an HMAC-signed token (including start time); on submit it validates the real play time (45–90 second window);
  3. Validates score caps, shot-count caps, `made ≤ shots`, and the difficulty enum;
  4. Max 3 submissions per user within 120 seconds to prevent score farming;
  5. `user_id` always comes from the server session (`getUser()`), so clients cannot impersonate others.
- A more thorough anti-cheat (server-side replay of the whole shot telemetry) has an extension point reserved in the code; see the comments in `src/lib/anti-cheat.ts`.

## Deploy to Vercel

1. Push this project to a GitHub repository.
2. At [vercel.com](https://vercel.com), click **Add New → Project** and import the repo (the framework is auto-detected as Next.js).
3. In **Environment Variables**, add the same variables as `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTI_CHEAT_SECRET`).
4. Click **Deploy**. Once finished, access the site via the Vercel-provided domain.

## Scripts

```bash
npm run dev      # Dev server
npm run build    # Production build
npm run start    # Run the production build
npm run lint     # ESLint check
```

## License

This project is **source-available for viewing only** under "All Rights Reserved"; see [LICENSE](./LICENSE).

No one may copy, modify, distribute, sublicense, sell, or use it for any commercial purpose without written permission from the copyright owner. For cooperation, use, or citations, please contact the author.
