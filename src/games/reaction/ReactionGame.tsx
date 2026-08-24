"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SubmitStatus, useScoreSubmit } from "@/hooks/useScoreSubmit";

type Phase = "ready" | "waiting" | "readyClick" | "tooSoon" | "done";
const ROUNDS = 3;

export function GameReaction() {
  const [phase, setPhase] = useState<Phase>("ready");
  const [round, setRound] = useState(1);
  const [times, setTimes] = useState<number[]>([]);
  const [result, setResult] = useState(0);
  const timeoutRef = useRef<number | null>(null);
  const startAtRef = useRef(0);
  const { requestToken, submit, submitState, submitError, resetSubmit } =
    useScoreSubmit("reaction");

  const calcScore = useCallback((msList: number[]) => {
    return msList.reduce((sum, t) => sum + Math.max(0, 500 - t), 0);
  }, []);

  const startRound = useCallback(
    (r: number, withWait = true) => {
      setPhase("waiting");
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (!withWait) return;
      timeoutRef.current = window.setTimeout(() => {
        startAtRef.current = performance.now();
        setPhase("readyClick");
      }, 1000 + Math.random() * 2000);
    },
    [],
  );

  const start = useCallback(() => {
    setRound(1);
    setTimes([]);
    setResult(0);
    resetSubmit();
    void requestToken();
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    startRound(1);
  }, [requestToken, resetSubmit, startRound]);

  const onTap = useCallback(() => {
    if (phase === "readyClick") {
      const ms = performance.now() - startAtRef.current;
      const next = [...times, ms];
      setTimes(next);
      if (next.length >= ROUNDS) {
        const sc = calcScore(next);
        setResult(sc);
        setPhase("done");
        void submit(sc);
      } else {
        setRound(next.length + 1);
        startRound(next.length + 1);
      }
    } else if (phase === "waiting") {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      setPhase("tooSoon");
      timeoutRef.current = window.setTimeout(() => startRound(round), 900);
    }
  }, [phase, times, round, startRound, calcScore, submit]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <div className="text-[10px] text-zinc-400">进度</div>
          <div className="text-xl font-bold text-orange-400">
            {phase === "done" ? ROUNDS : Math.min(round, ROUNDS)} / {ROUNDS}
          </div>
        </div>
        <button
          onClick={start}
          className="rounded-full bg-orange-500 px-6 py-2 font-bold text-black transition hover:bg-orange-400"
        >
          开始 / 重来
        </button>
      </div>

      <button
        onPointerDown={(e) => {
          e.preventDefault();
          onTap();
        }}
        className={cn(
          "flex h-[380px] w-full select-none flex-col items-center justify-center rounded-2xl border text-center transition",
          phase === "readyClick"
            ? "border-green-500/50 bg-green-500/20"
            : phase === "tooSoon"
              ? "border-red-500/50 bg-red-500/20"
              : "border-white/10 bg-[#0b0b11]",
        )}
      >
        {phase === "ready" && (
          <>
            <span className="text-3xl font-bold">点击反应</span>
            <span className="mt-2 text-sm text-zinc-400">点「开始」，等屏幕变绿后立刻点击</span>
          </>
        )}
        {phase === "waiting" && (
          <span className="text-4xl font-bold text-red-400">等待变绿…</span>
        )}
        {phase === "readyClick" && (
          <span className="text-5xl font-black text-green-400">点击！</span>
        )}
        {phase === "tooSoon" && (
          <span className="text-3xl font-bold text-red-400">太快了！等变绿再点</span>
        )}
        {phase === "done" && (
          <span className="text-4xl font-black text-orange-400">{result} 分</span>
        )}
      </button>

      {phase === "done" && (
        <div className="rounded-xl bg-black/60 px-4 py-3 text-center text-sm">
          <SubmitStatus state={submitState} error={submitError} />
        </div>
      )}

      <p className="text-center text-xs text-zinc-500">第 {Math.min(round, ROUNDS)} 轮 · 点击越快，得分越高</p>
    </div>
  );
}
