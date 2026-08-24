import Link from "next/link";
import { Trophy } from "lucide-react";
import { GAMES } from "@/games/registry";
import { GameCard } from "@/components/GameCard";
import { buttonVariants } from "@/components/ui/Button";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      {/* Hero */}
      <section className="animate-fade-in-up text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500/20 to-red-500/10 text-5xl shadow-inner">
          🏀
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
          小鱼 Game Center
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-muted-foreground sm:text-lg">
          简单好玩的在线小游戏合集。投篮挑战等你来战，刷新全球排行榜！
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/games/basketball" className={buttonVariants({ size: "lg" })}>
            🏀 开始游戏
          </Link>
          <Link
            href="/leaderboard"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <Trophy className="h-4 w-4" /> 排行榜
          </Link>
        </div>
      </section>

      {/* 游戏列表 */}
      <section className="mt-14">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-bold sm:text-2xl">游戏</h2>
          <span className="text-sm text-muted-foreground">更多小游戏持续上新</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {GAMES.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      </section>
    </div>
  );
}
