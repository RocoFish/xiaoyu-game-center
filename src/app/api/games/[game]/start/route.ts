import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { GAME_IDS, signGameToken, type GameId } from "@/lib/anti-cheat";

export const runtime = "nodejs";

// 通用开始令牌：为任意游戏签发带签名的令牌。
// 注意：basketball / snake 有更具体的路由，这里只服务其余游戏。
export async function POST(
  req: Request,
  { params }: { params: Promise<{ game: string }> },
) {
  const { game } = await params;
  try {
    if (!GAME_IDS.includes(game as GameId)) {
      return NextResponse.json({ ok: false, error: "未知的游戏。" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "请先登录。" }, { status: 401 });
    }

    const token = signGameToken({ gameId: game as GameId, startedAt: Date.now() });
    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json(
      { ok: false, error: "服务器错误，请稍后重试。" },
      { status: 500 },
    );
  }
}
