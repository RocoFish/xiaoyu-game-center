import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  validateScoreSubmission,
  type ScoreSubmission,
} from "@/lib/anti-cheat";

export const runtime = "nodejs";

// 单个用户 120 秒内的最大提交次数（防刷分）。
const MAX_SUBMISSIONS_PER_2MIN = 10;

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "请先登录。" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as ScoreSubmission;

    // 服务端校验（令牌签名 / 真实时长 / 数值范围）。
    const result = validateScoreSubmission(body);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    // 限流
    const since = new Date(Date.now() - 120_000).toISOString();
    const { count, error: countErr } = await supabase
      .from("game_scores")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("played_at", since);
    if (countErr) {
      return NextResponse.json(
        { ok: false, error: "服务器错误，请稍后重试。" },
        { status: 500 },
      );
    }
    if ((count ?? 0) >= MAX_SUBMISSIONS_PER_2MIN) {
      return NextResponse.json(
        { ok: false, error: "提交过于频繁，请稍后再试。" },
        { status: 429 },
      );
    }

    const { gameId, score, shots, madeShots, accuracy, maxStreak, difficulty } = result.data;

    const { error: insertErr } = await supabase.from("game_scores").insert({
      user_id: user.id,
      game_id: gameId,
      score,
      shots,
      made_shots: madeShots,
      accuracy,
      max_streak: maxStreak,
      difficulty,
    });

    if (insertErr) {
      return NextResponse.json(
        { ok: false, error: "成绩保存失败，请稍后重试。" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, score });
  } catch {
    return NextResponse.json(
      { ok: false, error: "服务器错误，请稍后重试。" },
      { status: 500 },
    );
  }
}
