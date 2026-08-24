"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SubmitStatus, useScoreSubmit } from "@/hooks/useScoreSubmit";
import {
  BALL_R,
  H,
  PADDLE_H,
  PADDLE_W,
  PADDLE_X,
  W,
  createPong,
  setPlayerY,
  step,
  type PongState,
} from "./engine";

export function GamePong() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<PongState>(createPong());
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const startedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const { requestToken, submit, submitState, submitError, resetSubmit } =
    useScoreSubmit("pong");

  const start = useCallback(() => {
    stateRef.current = createPong();
    setScore(0);
    setOver(false);
    resetSubmit();
    void requestToken();
    setStarted(true);
    startedRef.current = true;
  }, [requestToken, resetSubmit]);

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

      // 中线
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      const s = stateRef.current;

      // 玩家拍（左）橙色
      ctx.fillStyle = "#f97316";
      ctx.fillRect(PADDLE_X, s.playerY - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      // AI 拍（右）绿色
      ctx.fillStyle = "#34d399";
      ctx.fillRect(W - PADDLE_X - PADDLE_W, s.aiY - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      // 球
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
    };

    const loop = (now: number) => {
      const dt = lastTsRef.current ? Math.min((now - lastTsRef.current) / 1000, 0.05) : 0;
      lastTsRef.current = now;
      if (startedRef.current && !stateRef.current.over) {
        const r = step(stateRef.current, dt);
        setScore(stateRef.current.score);
        if (r.over) {
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

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientY - rect.top) / rect.height) * H;
    setPlayerY(stateRef.current, y);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
          <div className="text-[10px] text-zinc-400">我的得分</div>
          <div className="text-2xl font-black text-orange-400">{score}</div>
        </div>
        <div className="flex items-center justify-end">
          <button
            onClick={start}
            className="rounded-full bg-orange-500 px-6 py-2 font-bold text-black transition hover:bg-orange-400"
          >
            开始 / 重开
          </button>
        </div>
      </div>

      <div
        ref={wrapperRef}
        className="relative mx-auto aspect-[2/3] w-full max-w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b11] shadow-xl"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none select-none"
          onPointerMove={onPointerMove}
        />

        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-center">
            <h2 className="text-xl font-bold">Pong</h2>
            <p className="mt-1 text-sm text-zinc-400">移动鼠标/手指控制左侧球拍，接住球并让 AI 接不住</p>
            <button
              onClick={start}
              className="mt-4 rounded-full bg-orange-500 px-8 py-2.5 font-bold text-black transition hover:bg-orange-400"
            >
              开始游戏
            </button>
          </div>
        )}

        {over && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 text-center backdrop-blur">
            <div className="text-2xl font-bold">游戏结束</div>
            <div className="mt-1 text-sm text-zinc-400">
              得分：<span className="font-bold text-orange-400">{score}</span>
            </div>
            <div className="mt-1 text-sm">
              <SubmitStatus state={submitState} error={submitError} />
            </div>
            <button
              onClick={start}
              className="mt-4 rounded-full bg-orange-500 px-8 py-2.5 font-bold text-black transition hover:bg-orange-400"
            >
              再来一局
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-zinc-500">移动鼠标 / 手指控制球拍 · 球速会越来越快</p>
    </div>
  );
}
