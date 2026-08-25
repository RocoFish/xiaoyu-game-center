"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLang } from "@/lib/i18n";

const ForestGame = dynamic(() => import("@/games/forest").then((m) => m.ForestGame), {
  ssr: false,
  loading: () => <GameLoading />,
});

export default function ForestPage() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("nav.home")}
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-3xl">🌲</span>
        <div>
          <h1 className="text-2xl font-bold">《{t("game.forest.title")}》</h1>
          <p className="text-sm text-muted-foreground">{t("game.forest.desc")}</p>
        </div>
      </div>
      <div className="mt-5">
        <ForestGame />
      </div>
    </div>
  );
}

function GameLoading() {
  return (
    <div className="flex aspect-[26/18] w-full items-center justify-center rounded-2xl border border-border bg-card">
      <span className="animate-pulse text-muted-foreground">森林加载中…</span>
    </div>
  );
}
