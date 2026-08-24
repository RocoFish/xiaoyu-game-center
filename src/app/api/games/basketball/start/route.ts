import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { DIFFICULTIES, signGameToken } from "@/lib/anti-cheat";
import type { Difficulty } from "@/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { difficulty?: unknown };
    const difficulty = body.difficulty as Difficulty;

    if (!DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json(
        { ok: false, error: "难度参数无效。" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "请先登录。" }, { status: 401 });
    }

    const token = signGameToken({
      gameId: "basketball",
      difficulty,
      startedAt: Date.now(),
    });

    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json(
      { ok: false, error: "服务器错误，请稍后重试。" },
      { status: 500 },
    );
  }
}
