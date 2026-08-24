-- ============================================================
-- 让 PostgREST 能 JOIN game_scores 与 profiles（排行榜页需要）
-- game_scores.user_id 改为直接引用 profiles(id)，
-- 否则 `select("*, profiles(...)")` 会报“找不到关系”错误。
-- 在 Supabase SQL Editor 中执行本文件。
-- ============================================================

alter table public.game_scores
  drop constraint if exists game_scores_user_id_fkey;

alter table public.game_scores
  add constraint game_scores_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
