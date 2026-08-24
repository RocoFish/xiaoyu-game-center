-- ============================================================
-- 聊天区：messages 表 + RLS + Realtime
-- 在 Supabase SQL Editor 中执行本文件。
-- ============================================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text,
  avatar_url text,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_created on public.messages(created_at desc);

alter table public.messages enable row level security;

drop policy if exists "messages_public_read" on public.messages;
create policy "messages_public_read" on public.messages
  for select using (true);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages
  for insert with check (auth.uid() = user_id);

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own" on public.messages
  for delete using (auth.uid() = user_id);

-- 开启该表的 Realtime（可重复执行）
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
