"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useLeaderboard,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from "@/hooks/useLeaderboard";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import {
  cn,
  difficultyLabel,
  displayName,
  formatDate,
  formatPercent,
} from "@/lib/utils";

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "week", label: "本周" },
  { key: "all", label: "历史" },
];

const GAMES: { key: LeaderboardGame; label: string }[] = [
  { key: "basketball", label: "🏀 投篮挑战" },
  { key: "snake", label: "🐍 贪吃蛇" },
];

export function Leaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const [game, setGame] = useState<LeaderboardGame>("basketball");
  const { entries, myRank, loading, error } = useLeaderboard(period, game, user?.id);

  const isBasketball = game === "basketball";

  return (
    <div className="space-y-4">
      {/* 游戏切换 */}
      <div className="flex gap-2">
        {GAMES.map((g) => (
          <button
            key={g.key}
            onClick={() => setGame(g.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition",
              game === g.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* 周期切换 */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition",
              period === p.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 我的排名 */}
      {user && !loading && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <Trophy className="h-4 w-4 text-primary" />
          {myRank ? (
            <span>
              我的排名：<span className="font-bold text-primary">第 {myRank} 名</span>
            </span>
          ) : (
            <span>你还没有上榜，快去挑战吧！</span>
          )}
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Spinner /> 加载排行榜…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-8 text-center text-red-400">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-16 text-center text-muted-foreground">
          暂无记录，快来抢占榜首！{game === "basketball" ? "🏀" : "🐍"}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-3 font-medium sm:px-4">排名</th>
                <th className="px-3 py-3 font-medium sm:px-4">玩家</th>
                <th className="px-3 py-3 text-right font-medium sm:px-4">分数</th>
                {isBasketball && (
                  <th className="hidden px-3 py-3 text-right font-medium sm:table-cell sm:px-4">
                    命中率
                  </th>
                )}
                {isBasketball && (
                  <th className="hidden px-3 py-3 text-center font-medium md:table-cell sm:px-4">
                    难度
                  </th>
                )}
                <th className="hidden px-3 py-3 text-right font-medium lg:table-cell sm:px-4">
                  日期
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isMe = user?.id === e.user_id;
                return (
                  <tr
                    key={e.id}
                    className={cn(
                      "border-b border-border last:border-0",
                      isMe && "bg-primary/10",
                    )}
                  >
                    <td className="px-3 py-3 sm:px-4">
                      <span
                        className={cn(
                          "font-bold",
                          e.rank === 1 && "text-amber-400",
                          e.rank === 2 && "text-zinc-300",
                          e.rank === 3 && "text-orange-400",
                        )}
                      >
                        {e.rank}
                      </span>
                    </td>
                    <td className="px-3 py-3 sm:px-4">
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={e.profiles?.avatar_url}
                          name={e.profiles?.username}
                          size={32}
                        />
                        <span className="max-w-[120px] truncate sm:max-w-[180px]">
                          {displayName(e.profiles?.username)}
                          {isMe && <span className="ml-1 text-xs text-primary">(我)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-base font-bold sm:px-4">
                      {e.score}
                    </td>
                    {isBasketball && (
                      <td className="hidden px-3 py-3 text-right sm:table-cell sm:px-4">
                        {formatPercent(e.accuracy ?? 0)}
                      </td>
                    )}
                    {isBasketball && (
                      <td className="hidden px-3 py-3 text-center md:table-cell sm:px-4">
                        {difficultyLabel(e.difficulty)}
                      </td>
                    )}
                    <td className="hidden px-3 py-3 text-right text-muted-foreground lg:table-cell sm:px-4">
                      {formatDate(e.played_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        排行榜为公开数据 · 未登录玩家也可以查看
      </p>
      {!user && (
        <p className="text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            登录
          </Link>{" "}
          后即可保存成绩、查看自己的排名
        </p>
      )}
    </div>
  );
}
