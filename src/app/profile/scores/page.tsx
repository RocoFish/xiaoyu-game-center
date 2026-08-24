"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { Spinner } from "@/components/ui/Spinner";
import { buttonVariants } from "@/components/ui/Button";
import {
  difficultyLabel,
  formatDateTime,
  formatPercent,
  gameTitle,
} from "@/lib/utils";

export default function MyScoresPage() {
  const { user, loading } = useAuth();
  const { games, loading: gamesLoading } = usePlayerStats(user?.id ?? null);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Spinner className="mr-2" /> 加载中…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold">请先登录</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/login" className={buttonVariants()}>
            登录
          </Link>
          <Link href="/register" className={buttonVariants({ variant: "outline" })}>
            注册
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> 返回个人中心
      </Link>
      <h1 className="mt-3 text-2xl font-bold">我的成绩</h1>
      <p className="mt-1 text-sm text-muted-foreground">共 {games.length} 局游戏记录</p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        {gamesLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Spinner /> 加载中…
          </div>
        ) : games.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">还没有游戏记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">游戏</th>
                  <th className="px-4 py-3 font-medium">分数</th>
                  <th className="px-4 py-3 font-medium">投篮</th>
                  <th className="px-4 py-3 font-medium">命中</th>
                  <th className="px-4 py-3 font-medium">命中率</th>
                  <th className="px-4 py-3 font-medium">连中</th>
                  <th className="px-4 py-3 font-medium">难度</th>
                  <th className="px-4 py-3 text-right font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">{gameTitle(g.game_id)}</td>
                    <td className="px-4 py-2.5 font-bold">{g.score}</td>
                    <td className="px-4 py-2.5">{g.shots}</td>
                    <td className="px-4 py-2.5">{g.made_shots}</td>
                    <td className="px-4 py-2.5">{formatPercent(g.accuracy ?? 0)}</td>
                    <td className="px-4 py-2.5">{g.max_streak}</td>
                    <td className="px-4 py-2.5">{difficultyLabel(g.difficulty)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {formatDateTime(g.played_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
