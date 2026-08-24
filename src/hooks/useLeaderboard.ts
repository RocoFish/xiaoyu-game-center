"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { LeaderboardEntry } from "@/types";

export type LeaderboardPeriod = "today" | "week" | "all";
export type LeaderboardGame = "basketball" | "snake";

function periodStart(period: LeaderboardPeriod): Date | null {
  if (period === "all") return null;
  const d = new Date();
  if (period === "today") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // 本周一 00:00
  const day = d.getDay(); // 0=周日
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 按用户去重（每人取最高分一局），并计算排名。 */
function dedupeAndRank(raw: LeaderboardEntry[]): LeaderboardEntry[] {
  const best = new Map<string, LeaderboardEntry>();
  for (const e of raw) {
    const cur = best.get(e.user_id);
    if (!cur || e.score > cur.score) best.set(e.user_id, e);
  }
  const sorted = Array.from(best.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.played_at < b.played_at ? -1 : 1;
  });
  return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
}

export function useLeaderboard(
  period: LeaderboardPeriod,
  gameId: LeaderboardGame,
  userId?: string | null,
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      let query = supabase
        .from("game_scores")
        .select("*, profiles(username, avatar_url)")
        .eq("game_id", gameId)
        .order("score", { ascending: false })
        .limit(500);

      const start = periodStart(period);
      if (start) query = query.gte("played_at", start.toISOString());

      const { data, error: err } = await query;
      if (err) throw err;

      const ranked = dedupeAndRank((data as LeaderboardEntry[]) ?? []);
      setEntries(ranked.slice(0, 100));

      if (userId) {
        const idx = ranked.findIndex((e) => e.user_id === userId);
        setMyRank(idx >= 0 ? idx + 1 : null);
      } else {
        setMyRank(null);
      }
    } catch {
      setError("排行榜加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [period, gameId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { entries, myRank, loading, error, reload: load };
}
