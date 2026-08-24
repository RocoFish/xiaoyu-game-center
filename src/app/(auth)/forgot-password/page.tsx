"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/errors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("请输入邮箱。");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await getSupabaseBrowser().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      if (err) {
        setError(authErrorMessage(err));
        return;
      }
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <Card className="animate-fade-in-up p-6">
        <h1 className="text-2xl font-bold">找回密码</h1>

        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              重置链接已发送到 <span className="font-medium text-foreground">{email}</span>，请查收邮件并点击链接设置新密码。
            </p>
            <Link href="/login" className="block text-center text-primary hover:underline">
              返回登录
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              输入注册邮箱，我们会发送一封重置密码的邮件。
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
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

              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? (
                  <>
                    <Spinner /> 发送中…
                  </>
                ) : (
                  "发送重置邮件"
                )}
              </Button>

              <p className="text-center text-sm">
                <Link href="/login" className="text-primary hover:underline">
                  返回登录
                </Link>
              </p>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
