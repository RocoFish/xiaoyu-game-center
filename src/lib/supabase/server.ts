import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 服务端 Supabase 客户端（读取当前请求的会话 Cookie）。
 * 用于 API 路由 / Server Component：`getUser()` 校验登录态。
 * 注意：在 Server Component 中只能读 cookie，不能写；写入会抛错，这里做了兜底。
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component 中不允许写 cookie；忽略即可。
          }
        },
      },
    },
  );
}
