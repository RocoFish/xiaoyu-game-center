"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { GAMES } from "@/games/registry";
import { useLang } from "@/lib/i18n";
import { GameCard } from "@/components/GameCard";
import { buttonVariants } from "@/components/ui/Button";

export default function Home() {
  const { t } = useLang();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      {/* Hero */}
      <section className="animate-fade-in-up text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500/20 to-red-500/10 text-5xl shadow-inner">
          🏀
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">{t("home.title")}</h1>
        <p className="mx-auto mt-3 max-w-md text-base text-muted-foreground sm:text-lg">{t("home.sub")}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a href="#games" className={buttonVariants({ size: "lg" })}>
            {t("home.play")}
          </a>
          <Link href="/leaderboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <Trophy className="h-4 w-4" /> {t("home.leaderboard")}
          </Link>
        </div>
      </section>

      {/* 森林特色专区（独立于其他游戏） */}
      <section className="mt-12">
        {GAMES.filter((g) => g.featured).map((g) => (
          <Link
            key={g.id}
            href={`/games/${g.slug}`}
            className="group block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-green-900/70 via-green-800/20 to-transparent p-6 transition hover:border-green-400/40 sm:p-8"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="text-5xl">{g.emoji}</span>
                <div>
                  <h2 className="text-2xl font-black sm:text-3xl">《{t(`game.${g.id}.title`)}》</h2>
                  <p className="mt-1 text-sm text-muted-foreground sm:text-base">{t(`game.${g.id}.desc`)}</p>
                </div>
              </div>
              <span className={buttonVariants({ size: "lg" })}>{t("home.enterForest")}</span>
            </div>
          </Link>
        ))}
      </section>

      {/* 游戏选择区 */}
      <section id="games" className="mt-14 scroll-mt-16">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-bold sm:text-2xl">{t("home.more")}</h2>
          <span className="text-sm text-muted-foreground">{t("home.moreSub")}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {GAMES.filter((g) => !g.featured).map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      </section>
    </div>
  );
}
