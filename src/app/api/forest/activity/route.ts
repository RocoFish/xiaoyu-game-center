import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ACTIONS = ["pickup", "mushroom", "visit"];

// 全球森林今日统计：服务端累加（防作弊）。
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "请先登录。" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = body.action;
    if (!ACTIONS.includes(action as string)) {
      return NextResponse.json({ ok: false, error: "参数无效。" }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.rpc("bump_forest_stat", {
      p_day: today,
      p_action: action as string,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: "服务器错误，请稍后重试。" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "服务器错误，请稍后重试。" }, { status: 500 });
  }
}
