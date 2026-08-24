-- ============================================================
-- 支持多游戏（贪吃蛇等）接入排行榜
-- 在 Supabase SQL Editor 中执行本文件。
-- ============================================================

-- 1. difficulty 改为可空（贪吃蛇等游戏没有难度档位）
alter table public.game_scores alter column difficulty drop not null;

-- 2. 按游戏过滤排行榜的索引
create index if not exists idx_game_scores_game
  on public.game_scores(game_id, score desc);

create index if not exists idx_game_scores_game_played
  on public.game_scores(game_id, played_at desc);
