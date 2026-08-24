"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { createGame, GRID_SIZE, move, type Direction, type GameState } from "./engine";
import { SubmitStatus, useScoreSubmit } from "@/hooks/useScoreSubmit";

const DIR_KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

const TILE_STYLE: Record<number, string> = {
  0: "bg-white/[0.04]",
  2: "bg-zinc-200 text-zinc-800",
  4: "bg-amber-200 text-amber-900",
  8: "bg-orange-300 text-orange-950",
  16: "bg-orange-400 text-white",
  32: "bg-orange-500 text-white",
  64: "bg-red-400 text-white",
  128: "bg-yellow-400 text-white",
  256: "bg-yellow-500 text-white",
  512: "bg-amber-400 text-white",
  1024: "bg-amber-500 text-white",
  2048: "bg-green-500 text-white",
};

export function Game2048() {
  const [state, setState] = useState<GameState>(() => createGame());
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const { requestToken, submit, submitState, submitError, resetSubmit } = useScoreSubmit("2048");

  useEffect(() => {
    void requestToken();
  }, [requestToken]);

  const reset = useCallback(() => {
    setState(createGame());
    resetSubmit();
    void requestToken();
  }, [resetSubmit, requestToken]);

  const handleMove = useCallback((dir: Direction) => {
    setState((s) => move(s, dir));
  }, []);

  // 游戏结束 → 提交得分
  useEffect(() => {
    if (state.over) void submit(state.score);
  }, [state.over, state.score, submit]);

  // 键盘
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (DIR_KEYS[e.key]) {
        e.preventDefault();
        handleMove(DIR_KEYS[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleMove]);

  // 触摸滑动
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    touchRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!touchRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - touchRef.current.x;
      const dy = y - touchRef.current.y;
      touchRef.current = null;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) handleMove(dx > 0 ? "right" : "left");
      else handleMove(dy > 0 ? "down" : "up");
    },
    [handleMove],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 计分 + 新游戏 */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-2">
        <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
          <div className="text-[10px] text-zinc-400">得分</div>
          <div className="text-2xl font-black text-orange-400">{state.score}</div>
        </div>
        <button
          onClick={reset}
          className="rounded-full bg-orange-500 px-6 py-2 font-bold text-black transition hover:bg-orange-400"
        >
          新游戏
        </button>
      </div>

      {/* 棋盘 */}
      <div className="relative rounded-2xl border border-white/10 bg-[#0b0b11] p-2 shadow-xl">
        <div
          className="grid touch-none select-none gap-2"
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {state.board.flat().map((v, i) => (
            <div
              key={i}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-2xl font-black transition sm:text-3xl",
                TILE_STYLE[v] ?? "bg-green-600 text-white",
              )}
            >
              {v !== 0 ? v : ""}
            </div>
          ))}
        </div>

        {/* 达成 2048 提示 */}
        {state.won && !state.over && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl">
            <div className="rounded-xl bg-black/75 px-6 py-4 text-center backdrop-blur">
              <div className="text-xl font-bold text-green-400">🎉 达成 2048！</div>
              <p className="mt-1 text-xs text-zinc-400">可以继续挑战更高分，或点「新游戏」重来。</p>
            </div>
          </div>
        )}

        {/* 游戏结束 */}
        {state.over && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-black/70 backdrop-blur">
            <div className="text-2xl font-bold">游戏结束</div>
            <div className="mt-1 text-sm text-zinc-400">
              得分：<span className="font-bold text-orange-400">{state.score}</span>
            </div>
            <div className="mt-1 text-sm">
              <SubmitStatus state={submitState} error={submitError} />
            </div>
            <button
              onClick={reset}
              className="mt-4 rounded-full bg-orange-500 px-8 py-2.5 font-bold text-black transition hover:bg-orange-400"
            >
              再来一局
            </button>
          </div>
        )}
      </div>

      {/* 屏幕方向键（移动端友好） */}
      <div className="mx-auto grid grid-cols-3 gap-2">
        <div />
        <DirBtn label="▲" onPress={() => handleMove("up")} />
        <div />
        <DirBtn label="◀" onPress={() => handleMove("left")} />
        <DirBtn label="▼" onPress={() => handleMove("down")} />
        <DirBtn label="▶" onPress={() => handleMove("right")} />
      </div>

      <p className="text-center text-xs text-zinc-500">
        方向键 / WASD 控制 · 手机滑动或点方向键 · 相同数字相消合并
      </p>
    </div>
  );
}

function DirBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl text-zinc-200 transition active:bg-white/15"
    >
      {label}
    </button>
  );
}
