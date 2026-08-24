"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/errors";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";
import { SocialLogin } from "@/components/SocialLogin";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const router = useRouter();
  const { refreshProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  // 注册两步：填写信息 -> 输入邮箱验证码
  const [step, setStep] = useState<"form" | "verify">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleRegister() {
    if (!email.trim()) {
      setError("请输入邮箱。");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要 6 位。");
      return;
    }
    if (!username.trim()) {
      setError("请设置一个用户名。");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const supabase = getSupabaseBrowser();

      // 用户名占用检查（best-effort）
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.trim())
        .maybeSingle();
      if (existing) {
        setError("该用户名已被使用，请换一个。");
        setLoading(false);
        return;
      }

      // 1. 创建账号（用户名通过 metadata 由数据库触发器写入 profile）
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: username.trim() } },
      });
      if (signUpErr) {
        setError(authErrorMessage(signUpErr));
        setLoading(false);
        return;
      }

      // 2. 若未开启邮箱验证（signUp 直接返回会话），直接登录
      if (data.session) {
        await refreshProfile();
        router.push("/");
        return;
      }

      // 3. 开启邮箱验证：发送 6 位验证码到邮箱
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (otpErr) {
        setError(authErrorMessage(otpErr));
        setLoading(false);
        return;
      }
      setStep("verify");
      setNotice("验证码已发送到你的邮箱，请查收（可能被当作垃圾邮件）。");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) {
      setError("请输入邮箱验证码。");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const supabase = getSupabaseBrowser();
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (verifyErr) {
        setError("验证码错误或已过期，请重新输入。");
        setLoading(false);
        return;
      }
      await refreshProfile();
      router.push("/");
    } catch (err) {
      setError(authErrorMessage(err));
      setLoading(false);
    }
  }

  async function resendCode() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const { error: otpErr } = await getSupabaseBrowser().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (otpErr) {
        setError(authErrorMessage(otpErr));
      } else {
        setNotice("验证码已重新发送。");
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim()) {
      setError("请输入邮箱。");
      return;
    }
    if (!password) {
      setError("请输入密码。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error } = await getSupabaseBrowser().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(authErrorMessage(error));
        return;
      }
      await refreshProfile();
      router.push("/");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (isRegister) {
      if (step === "form") await handleRegister();
      else await handleVerifyCode();
    } else {
      await handleLogin();
    }
  }

  // 注册第二步：输入验证码
  if (isRegister && step === "verify") {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          我们已向 <span className="font-medium text-foreground">{email}</span> 发送了 6 位验证码，请填写完成注册。
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="code">邮箱验证码</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6 位数字"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="text-center text-lg tracking-[0.5em]"
            autoFocus
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            {notice}
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? (
            <>
              <Spinner /> 验证中…
            </>
          ) : (
            "完成注册"
          )}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={resendCode}
            disabled={loading}
            className="text-primary hover:underline disabled:opacity-50"
          >
            重新发送验证码
          </button>
          <button
            type="button"
            onClick={() => setStep("form")}
            className="text-muted-foreground hover:text-foreground"
          >
            返回修改
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <SocialLogin />
      <div className="relative my-5 text-center text-xs text-muted-foreground">
        <span className="relative z-10 bg-card px-2">或使用邮箱</span>
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
      {isRegister && (
        <div className="space-y-1.5">
          <Label htmlFor="username">用户名</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用于排行榜显示"
            autoComplete="username"
            maxLength={24}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 6 位"
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          {notice}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading ? (
          <>
            <Spinner /> {isRegister ? "注册中…" : "登录中…"}
          </>
        ) : isRegister ? (
          "注册"
        ) : (
          "登录"
        )}
      </Button>

      {!isRegister && (
        <p className="text-right text-sm">
          <Link href="/forgot-password" className="text-primary hover:underline">
            忘记密码？
          </Link>
        </p>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {isRegister ? (
          <>
            已有账号？{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              去登录
            </Link>
          </>
        ) : (
          <>
            还没有账号？{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              去注册
            </Link>
          </>
        )}
      </p>
      </form>
    </div>
  );
}
