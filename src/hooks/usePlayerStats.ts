"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { GameScore, PlayerStats } from "@/types";

export function usePlayerStats(userId: string | null) {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [games, setGames] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setStats(null);
      setGames([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error: err } = await supabase
        .from("game_scores")
        .select("*")
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(500);
      if (err) throw err;

      const list = (data as GameScore[]) ?? [];
      setGames(list);

      const totalGames = list.length;
      const bestScore = list.reduce((m, g) => Math.max(m, g.score), 0);
      const bestAccuracy = list.reduce((m, g) => Math.max(m, g.accuracy ?? 0), 0);
      const bestStreak = list.reduce((m, g) => Math.max(m, g.max_streak), 0);
      setStats({ totalGames, bestScore, bestAccuracy, bestStreak });
    } catch {
      setError("个人数据加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { stats, games, loading, error, reload: load };
}
