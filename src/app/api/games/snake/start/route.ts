import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { signGameToken } from "@/lib/anti-cheat";

export const runtime = "nodejs";

export async function POST(_req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "请先登录。" }, { status: 401 });
    }

    const token = signGameToken({ gameId: "snake", startedAt: Date.now() });
    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json(
      { ok: false, error: "服务器错误，请稍后重试。" },
      { status: 500 },
    );
  }
}
