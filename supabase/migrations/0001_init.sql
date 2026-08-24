-- ============================================================
-- 小鱼 Game Center · 数据库初始化
-- 在 Supabase 控制台 SQL Editor 中完整执行本文件（可重复执行）。
-- ============================================================

-- 1. 用户资料表
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2. 游戏成绩表
create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null default 'basketball',
  score integer not null check (score >= 0),
  shots integer not null check (shots >= 0),
  made_shots integer not null check (made_shots >= 0 and made_shots <= shots),
  accuracy numeric(5,4),
  max_streak integer not null default 0 check (max_streak >= 0),
  difficulty text not null check (difficulty in ('easy','normal','hard')),
  played_at timestamptz not null default now()
);

-- 3. 索引（排行榜 / 个人记录 / 时间过滤）
create index if not exists idx_game_scores_score   on public.game_scores(score desc);
create index if not exists idx_game_scores_user    on public.game_scores(user_id, played_at desc);
create index if not exists idx_game_scores_played  on public.game_scores(played_at desc);
create index if not exists idx_profiles_username   on public.profiles(username);

-- 4. 开启行级安全
alter table public.profiles     enable row level security;
alter table public.game_scores  enable row level security;

-- 5. profiles 策略：公开只读；仅本人可增改删
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles
  for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- 6. game_scores 策略：排行榜公开只读；仅本人可写、可删
drop policy if exists "scores_public_read" on public.game_scores;
create policy "scores_public_read" on public.game_scores
  for select using (true);

drop policy if exists "scores_insert_own" on public.game_scores;
create policy "scores_insert_own" on public.game_scores
  for insert with check (auth.uid() = user_id);

drop policy if exists "scores_delete_own" on public.game_scores;
create policy "scores_delete_own" on public.game_scores
  for delete using (auth.uid() = user_id);

-- 7. 触发器：注册时自动创建 profile（用户名取自注册时的 metadata）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, nullif(new.raw_user_meta_data->>'username', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 8. 头像存储桶（公开读，本人可写自己的目录 avatars/<uid>/）
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
