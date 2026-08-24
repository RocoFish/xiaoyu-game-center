import type { Metadata } from "next";
import { Leaderboard } from "@/components/Leaderboard";

export const metadata: Metadata = { title: "排行榜" };

export default function LeaderboardPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold sm:text-3xl">🏆 排行榜</h1>
        <p className="mt-1 text-sm text-muted-foreground">看看谁是最强投手</p>
      </div>
      <div className="mt-6">
        <Leaderboard />
      </div>
    </div>
  );
}
