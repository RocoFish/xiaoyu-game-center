"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SubmitStatus, useScoreSubmit } from "@/hooks/useScoreSubmit";
import {
  CAR_H,
  CAR_W,
  CAR_Y,
  H,
  LANES,
  LANE_W,
  W,
  createRace,
  move,
  step,
  type RaceState,
} from "./engine";

export function GameRacing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<RaceState>(createRace());
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const startedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const { requestToken, submit, submitState, submitError, resetSubmit } =
    useScoreSubmit("racing");

  const start = useCallback(() => {
    stateRef.current = createRace();
    setScore(0);
    setOver(false);
    resetSubmit();
    void requestToken();
    setStarted(true);
    startedRef.current = true;
  }, [requestToken, resetSubmit]);

  const steer = useCallback((dir: -1 | 1) => {
    move(stateRef.current, dir);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0b0b11";
      ctx.fillRect(0, 0, W, H);

      // 车道线
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 2;
      for (let i = 1; i < LANES; i++) {
        const x = i * LANE_W;
        ctx.setLineDash([12, 12]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const s = stateRef.current;

      // 障碍（红色块）
      for (const o of s.obstacles) {
        const x = o.lane * LANE_W + (LANE_W - o.w) / 2;
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(x, o.y, o.w, o.h);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(x + 8, o.y + 8, o.w - 16, o.h - 16);
      }

      // 玩家（橙色车）
      const pxx = s.lane * LANE_W + (LANE_W - CAR_W) / 2;
      ctx.fillStyle = "#f97316";
      ctx.fillRect(pxx, CAR_Y, CAR_W, CAR_H);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(pxx + 10, CAR_Y + 8, CAR_W - 20, CAR_H - 16);
    };

    const loop = (now: number) => {
      const dt = lastTsRef.current ? Math.min((now - lastTsRef.current) / 1000, 0.05) : 0;
      lastTsRef.current = now;
      if (startedRef.current && !stateRef.current.over) {
        step(stateRef.current, dt);
        setScore(stateRef.current.score);
        if (stateRef.current.over) {
          setOver(true);
          startedRef.current = false;
          void submit(stateRef.current.score);
        }
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!startedRef.current) return;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") steer(-1);
      else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") steer(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steer]);

  const onTap = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!startedRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    steer(x < rect.width / 2 ? -1 : 1);
  }, [steer]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
          <div className="text-[10px] text-zinc-400">得分</div>
          <div className="text-2xl font-black text-orange-400">{score}</div>
        </div>
        <div className="flex items-center justify-end">
          <button onClick={start} className="rounded-full bg-orange-500 px-6 py-2 font-bold text-black transition hover:bg-orange-400">
            开始 / 重开
          </button>
        </div>
      </div>

      <div className="relative mx-auto aspect-[3/5] w-full max-w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b11] shadow-xl">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none select-none"
          onPointerDown={onTap}
        />

        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-center">
            <h2 className="text-xl font-bold">赛车</h2>
            <p className="mt-1 text-sm text-zinc-400">左右移动躲避来车，活得越久分越高</p>
            <button onClick={start} className="mt-4 rounded-full bg-orange-500 px-8 py-2.5 font-bold text-black transition hover:bg-orange-400">
              开始游戏
            </button>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 text-center backdrop-blur">
            <div className="text-2xl font-bold">撞车了</div>
            <div className="mt-1 text-sm text-zinc-400">
              得分：<span className="font-bold text-orange-400">{score}</span>
            </div>
            <div className="mt-1 text-sm">
              <SubmitStatus state={submitState} error={submitError} />
            </div>
            <button onClick={start} className="mt-4 rounded-full bg-orange-500 px-8 py-2.5 font-bold text-black transition hover:bg-orange-400">
              再来一局
            </button>
          </div>
        )}
      </div>

      {/* 屏幕左右键 + 提示 */}
      <div className="mx-auto flex gap-3">
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            steer(-1);
          }}
          className="flex h-12 w-16 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl text-zinc-200 transition active:bg-white/15"
        >
          ◀
        </button>
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            steer(1);
          }}
          className="flex h-12 w-16 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl text-zinc-200 transition active:bg-white/15"
        >
          ▶
        </button>
      </div>

      <p className="text-center text-xs text-zinc-500">方向键 / 点屏幕左右侧 · 躲避红色的车</p>
    </div>
  );
}
