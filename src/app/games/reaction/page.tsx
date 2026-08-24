"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getGameBySlug } from "@/games/registry";

const GameReaction = dynamic(() => import("@/games/reaction").then((m) => m.GameReaction), {
  ssr: false,
  loading: () => <GameLoading />,
});

const game = getGameBySlug("reaction");

export default function ReactionPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> 返回首页
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-3xl">{game?.emoji}</span>
        <div>
          <h1 className="text-2xl font-bold">{game?.title}</h1>
          <p className="text-sm text-muted-foreground">{game?.description}</p>
        </div>
      </div>
      <div className="mt-5">
        <GameReaction />
      </div>
    </div>
  );
}

function GameLoading() {
  return (
    <div className="flex h-[420px] w-full items-center justify-center rounded-2xl border border-border bg-card">
      <span className="animate-pulse text-muted-foreground">游戏加载中…</span>
    </div>
  );
}
