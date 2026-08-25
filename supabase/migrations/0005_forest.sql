-- ============================================================
-- 《森林里好像有什么》：个人状态 + 全球今日统计 + RLS
-- 在 Supabase SQL Editor 中执行本文件。
-- ============================================================

-- 玩家森林状态（一个用户一行，JSONB 存 背包/图鉴/统计/小屋）
create table if not exists public.forest_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.forest_state enable row level security;

drop policy if exists "forest_state_select_own" on public.forest_state;
create policy "forest_state_select_own" on public.forest_state
  for select using (auth.uid() = user_id);

drop policy if exists "forest_state_insert_own" on public.forest_state;
create policy "forest_state_insert_own" on public.forest_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "forest_state_update_own" on public.forest_state;
create policy "forest_state_update_own" on public.forest_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 全球今日统计（公开可读，写只能走 security definer 函数）
create table if not exists public.forest_daily_stats (
  day date not null,
  action text not null,
  total bigint not null default 0,
  primary key (day, action)
);

alter table public.forest_daily_stats enable row level security;

drop policy if exists "forest_stats_read" on public.forest_daily_stats;
create policy "forest_stats_read" on public.forest_daily_stats
  for select using (true);

create or replace function public.bump_forest_stat(p_day date, p_action text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.forest_daily_stats(day, action, total)
  values (p_day, p_action, 1)
  on conflict (day, action) do update
  set total = public.forest_daily_stats.total + 1;
$$;
