"use client";

import { useState } from "react";
import Link from "next/link";
import { Medal } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/errors";
import { Avatar } from "@/components/Avatar";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";
import { Card } from "@/components/ui/Card";
import {
  DIFFICULTY_LABEL,
  displayName,
  formatDateTime,
  formatPercent,
} from "@/lib/utils";

export default function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { stats, games, loading: statsLoading } = usePlayerStats(user?.id ?? null);

  const [username, setUsername] = useState(profile?.username ?? "");
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Spinner className="mr-2" /> 加载中…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold">请先登录</p>
        <p className="mt-1 text-sm text-muted-foreground">登录后即可查看个人中心与游戏记录</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/login" className={buttonVariants()}>
            登录
          </Link>
          <Link href="/register" className={buttonVariants({ variant: "outline" })}>
            注册
          </Link>
        </div>
      </div>
    );
  }

  async function saveUsername() {
    if (!user) return;
    const name = username.trim();
    if (!name) {
      setMsg("用户名不能为空。");
      return;
    }
    setSavingName(true);
    setMsg("");
    try {
      const supabase = getSupabaseBrowser();
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", name)
        .neq("id", user.id)
        .maybeSingle();
      if (existing) {
        setMsg("该用户名已被使用，请换一个。");
        return;
      }
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, username: name }, { onConflict: "id" });
      if (error) throw error;
      await refreshProfile();
      setMsg("用户名已更新。");
    } catch (e) {
      setMsg(dbErrorMessage(e));
    } finally {
      setSavingName(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      setMsg("图片不能超过 2MB。");
      return;
    }
    setUploading(true);
    setMsg("");
    try {
      const supabase = getSupabaseBrowser();
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", user.id);
      await refreshProfile();
      setMsg("头像已更新。");
    } catch (err) {
      setMsg(dbErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  const recent = games.slice(0, 5);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* 资料卡片 */}
      <Card className="animate-fade-in-up p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative">
            <Avatar src={profile?.avatar_url} name={profile?.username ?? user.email} size={80} />
            <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-full border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm hover:text-foreground">
              {uploading ? "上传中…" : "换头像"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarChange}
                disabled={uploading}
              />
            </label>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-bold">{displayName(profile?.username)}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="flex-1 space-y-1.5 text-left">
                <Label htmlFor="username">用户名</Label>
                <div className="flex gap-2">
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={24}
                    placeholder="设置用户名"
                  />
                  <Button onClick={saveUsername} disabled={savingName} variant="secondary">
                    {savingName ? "保存中…" : "保存"}
                  </Button>
                </div>
              </div>
            </div>
            {msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}
          </div>
        </div>
      </Card>

      {/* 统计 */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="历史最高分" value={statsLoading ? "…" : String(stats?.bestScore ?? 0)} highlight />
        <StatCard label="总游戏次数" value={statsLoading ? "…" : String(stats?.totalGames ?? 0)} />
        <StatCard label="最高命中率" value={statsLoading ? "…" : formatPercent(stats?.bestAccuracy ?? 0)} />
        <StatCard label="最高连中" value={statsLoading ? "…" : String(stats?.bestStreak ?? 0)} />
      </div>

      {/* 最近记录 */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-bold">最近游戏</h2>
        <Link
          href="/profile/scores"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Medal className="h-4 w-4" /> 我的成绩
        </Link>
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
        {statsLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Spinner /> 加载中…
          </div>
        ) : recent.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">还没有游戏记录，快去挑战吧！</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">分数</th>
                <th className="px-4 py-2.5 font-medium">命中率</th>
                <th className="px-4 py-2.5 font-medium">连中</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">难度</th>
                <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">时间</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((g) => (
                <tr key={g.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-bold">{g.score}</td>
                  <td className="px-4 py-2.5">{formatPercent(g.accuracy ?? 0)}</td>
                  <td className="px-4 py-2.5">{g.max_streak}</td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">{DIFFICULTY_LABEL[g.difficulty]}</td>
                  <td className="hidden px-4 py-2.5 text-right text-muted-foreground sm:table-cell">
                    {formatDateTime(g.played_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className="p-4 text-center">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-black ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
    </Card>
  );
}
