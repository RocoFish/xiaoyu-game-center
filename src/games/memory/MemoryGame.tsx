"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SubmitStatus, useScoreSubmit } from "@/hooks/useScoreSubmit";
import { clearFlipped, createGame, flip, score, type MemoryState } from "./engine";

const EMOJIS = ["🍎", "🍌", "🍇", "🍓", "🍊", "🍉", "🍒", "🥝"];

export function GameMemory() {
  const [state, setState] = useState<MemoryState>(() => createGame());
  const { requestToken, submit, submitState, submitError, resetSubmit } =
    useScoreSubmit("memory");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    void requestToken();
  }, [requestToken]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  // 全部配对 → 提交
  useEffect(() => {
    if (state.done) void submit(score(state));
  }, [state.done, state, submit]);

  const restart = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setState(createGame());
    resetSubmit();
  }, [resetSubmit]);

  const onCard = useCallback((index: number) => {
    setState((s) => {
      if (s.done || s.flipped.length >= 2) return s;
      const next = flip(s, index);
      if (next.flipped.length === 2) {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          setState((s2) => clearFlipped(s2));
        }, 850);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <div className="text-[10px] text-zinc-400">步数</div>
          <div className="text-xl font-bold text-orange-400">{state.moves}</div>
        </div>
        <button
          onClick={restart}
          className="rounded-full bg-orange-500 px-6 py-2 font-bold text-black transition hover:bg-orange-400"
        >
          重新开始
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {state.cards.map((v, i) => {
          const revealed = state.matched[i] || state.flipped.includes(i);
          return (
            <button
              key={i}
              onClick={() => onCard(i)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-xl border text-3xl transition",
                state.matched[i]
                  ? "border-green-500/40 bg-green-500/10"
                  : revealed
                    ? "border-orange-500/40 bg-orange-500/15"
                    : "border-white/10 bg-white/5 hover:border-white/25",
              )}
            >
              {revealed ? EMOJIS[v - 1] : "❓"}
            </button>
          );
        })}
      </div>

      {state.done && (
        <div className="rounded-xl bg-black/60 px-4 py-3 text-center">
          <div className="text-lg font-bold">🎉 完成！{score(state)} 分</div>
          <div className="mt-1 text-sm">
            <SubmitStatus state={submitState} error={submitError} />
          </div>
        </div>
      )}

      <p className="text-center text-xs text-zinc-500">
        点击翻开两张，相同的消除；步数越少得分越高。
      </p>
    </div>
  );
}
