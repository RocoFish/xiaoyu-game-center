"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/errors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "done">("loading");
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setStatus("error");
      setError("重置链接无效或已过期。");
      return;
    }
    getSupabaseBrowser()
      .auth.exchangeCodeForSession(code)
      .then(({ error: err }) => {
        if (err) {
          setStatus("error");
          setError(authErrorMessage(err));
        } else {
          setStatus("ready");
        }
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("新密码至少需要 6 位。");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await getSupabaseBrowser().auth.updateUser({ password });
      if (err) {
        setError(authErrorMessage(err));
        return;
      }
      setStatus("done");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <Card className="animate-fade-in-up p-6">
        <h1 className="text-2xl font-bold">设置新密码</h1>

        {status === "loading" && (
          <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
            <Spinner /> 正在校验链接…
          </div>
        )}

        {status === "error" && (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
            <Link href="/forgot-password" className="block text-center text-primary hover:underline">
              重新申请重置链接
            </Link>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">新密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting ? (
                <>
                  <Spinner /> 保存中…
                </>
              ) : (
                "确认修改"
              )}
            </Button>
          </form>
        )}

        {status === "done" && (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">密码已重置成功，请使用新密码登录。</p>
            <Link href="/login" className="inline-block text-primary hover:underline">
              去登录
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
