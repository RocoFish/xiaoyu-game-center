// 将底层错误映射为面向用户的中文提示，绝不直接展示原始报错。

export function authErrorMessage(err: unknown): string {
  const message =
    typeof (err as { message?: unknown } | null)?.message === "string"
      ? ((err as { message: string }).message as string)
      : "";
  const m = message.toLowerCase();

  if (m.includes("invalid login credentials")) return "邮箱或密码错误。";
  if (m.includes("email not confirmed")) return "邮箱尚未验证，请先查收确认邮件。";
  if (m.includes("user already registered")) return "该邮箱已注册，请直接登录。";
  if (m.includes("password should be at least")) return "密码至少需要 6 位。";
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return "邮箱格式不正确。";
  if (m.includes("rate limit") || m.includes("too many requests"))
    return "操作过于频繁，请稍后再试。";
  if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch"))
    return "网络异常，请检查网络连接。";
  if (m.includes("duplicate") || m.includes("unique")) return "该用户名已被使用，请换一个。";

  return "操作失败，请稍后重试。";
}

export function dbErrorMessage(err: unknown): string {
  const message =
    typeof (err as { message?: unknown } | null)?.message === "string"
      ? ((err as { message: string }).message as string)
      : "";
  const m = message.toLowerCase();
  if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch"))
    return "网络异常，请检查网络连接。";
  if (m.includes("duplicate") || m.includes("unique")) return "该用户名已被使用，请换一个。";
  if (m.includes("jwt") || m.includes("token") || m.includes("unauthorized"))
    return "登录状态已失效，请重新登录。";
  return "数据请求失败，请稍后重试。";
}
