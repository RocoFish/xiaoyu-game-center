"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export type SubmitState = "idle" | "saving" | "saved" | "error" | "need-login";

/**
 * 通用成绩提交：开始游戏时领取令牌，结束时提交分数。
 * 用于 2048 / 记忆翻牌 / Pong / 反应 / 赛车 这类「单分数」游戏。
 */
export function useScoreSubmit(gameId: string) {
  const { user } = useAuth();
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef(user);
  const submittedRef = useRef(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const requestToken = useCallback(async () => {
    tokenRef.current = null;
    if (!userRef.current) return;
    try {
      const res = await fetch(`/api/games/${gameId}/start`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data?.token) tokenRef.current = data.token;
      }
    } catch {
      // 领取失败则视为未登录，结束时不提交
    }
  }, [gameId]);

  const submit = useCallback(
    async (score: number, difficulty?: string) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      if (!userRef.current) {
        setSubmitState("need-login");
        return;
      }
      if (!tokenRef.current) {
        setSubmitState("error");
        setSubmitError("成绩保存失败，请重试。");
        return;
      }
      setSubmitState("saving");
      try {
        const res = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameToken: tokenRef.current, score, difficulty }),
        });
        const data = await res.json();
        if (res.ok && data?.ok) {
          setSubmitState("saved");
        } else {
          setSubmitState("error");
          setSubmitError(data?.error || "成绩保存失败，请稍后重试。");
        }
      } catch {
        setSubmitState("error");
        setSubmitError("网络异常，成绩未能保存。");
      }
    },
    [],
  );

  const resetSubmit = useCallback(() => {
    submittedRef.current = false;
    setSubmitState("idle");
    setSubmitError("");
  }, []);

  return { requestToken, submit, submitState, submitError, resetSubmit };
}

/** 通用提交状态展示（游戏结束覆盖层里用）。 */
export function SubmitStatus({ state, error }: { state: SubmitState; error: string }) {
  if (state === "saving") return <span className="text-zinc-400">正在保存成绩…</span>;
  if (state === "saved") return <span className="text-emerald-400">✓ 成绩已保存到排行榜</span>;
  if (state === "error") return <span className="text-red-400">{error}</span>;
  if (state === "need-login") return <span className="text-zinc-400">登录后即可保存成绩</span>;
  return null;
}
