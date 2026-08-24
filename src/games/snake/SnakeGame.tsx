"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  GRID,
  createGame,
  queueDirection,
  step,
  tickIntervalMs,
  type Direction,
  type SnakeState,
} from "./engine";

type Phase = "ready" | "playing" | "paused" | "ended";
type SubmitState = "idle" | "saving" | "saved" | "error" | "need-login";

const DIR_KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function SnakeGame() {
  const { user } = useAuth();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  const stateRef = useRef<SnakeState>(createGame());
  const phaseRef = useRef<Phase>("ready");
  const scoreRef = useRef(0);

  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const accRef = useRef(0);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef(user);
  const submittedRef = useRef(false);

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("snake_best") ?? 0));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const requestToken = useCallback(async () => {
    tokenRef.current = null;
    if (!userRef.current) return;
    try {
      const res = await fetch("/api/games/snake/start", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data?.token) tokenRef.current = data.token;
      }
    } catch {
      // 领取失败则视为未登录，结束时不提交
    }
  }, []);

  const submitScore = useCallback(async () => {
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
        body: JSON.stringify({ gameToken: tokenRef.current, score: scoreRef.current }),
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
  }, []);

  const startGame = useCallback(() => {
    stateRef.current = createGame();
    scoreRef.current = 0;
    accRef.current = 0;
    setScore(0);
    submittedRef.current = false;
    setSubmitState("idle");
    setSubmitError("");
    void requestToken();
    setPhase("playing");
  }, [setPhase, requestToken]);

  const endGame = useCallback(() => {
    setPhase("ended");
    const s = scoreRef.current;
    try {
      const prev = Number(localStorage.getItem("snake_best") ?? 0);
      if (s > prev) {
        localStorage.setItem("snake_best", String(s));
        setBest(s);
      }
    } catch {
      // ignore
    }
    void submitScore();
  }, [setPhase, submitScore]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "playing") setPhase("paused");
    else if (phaseRef.current === "paused") setPhase("playing");
  }, [setPhase]);

  const setDirection = useCallback((d: Direction) => {
    if (phaseRef.current !== "playing") return;
    queueDirection(stateRef.current, d);
  }, []);

  // 画布尺寸
  useEffect(() => {
    const resize = () => {
      const wrapper = wrapperRef.current;
      const canvas = canvasRef.current;
      if (!wrapper || !canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = wrapper.clientWidth;
      const h = wrapper.clientHeight;
      if (w === 0 || h === 0) return;
      sizeRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  // 主循环：按分数动态提速，推进 + 绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const { w, h } = sizeRef.current;
      if (w === 0 || h === 0) return;
      const cell = Math.min(w, h) / GRID;
      const ox = (w - cell * GRID) / 2;
      const oy = (h - cell * GRID) / 2;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0b0b11";
      ctx.fillRect(0, 0, w, h);

      // 棋盘边框
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.strokeRect(ox, oy, cell * GRID, cell * GRID);

      // 网格线
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let i = 1; i < GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(ox + i * cell, oy);
        ctx.lineTo(ox + i * cell, oy + cell * GRID);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox, oy + i * cell);
        ctx.lineTo(ox + cell * GRID, oy + i * cell);
        ctx.stroke();
      }

      const st = stateRef.current;

      // 食物
      const fx = ox + st.food.x * cell;
      const fy = oy + st.food.y * cell;
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(fx + cell / 2, fy + cell / 2, cell * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // 蛇
      st.snake.forEach((p, i) => {
        const x = ox + p.x * cell;
        const y = oy + p.y * cell;
        ctx.fillStyle = i === 0 ? "#34d399" : "#10b981";
        roundRect(ctx, x + 1, y + 1, cell - 2, cell - 2, cell * 0.28);
        ctx.fill();
      });

      // 头部眼睛
      const head = st.snake[0];
      const hx = ox + head.x * cell;
      const hy = oy + head.y * cell;
      ctx.fillStyle = "#064e3b";
      const eye = cell * 0.1;
      if (st.dir === "left" || st.dir === "right") {
        const ex = st.dir === "right" ? hx + cell * 0.7 : hx + cell * 0.3;
        ctx.beginPath();
        ctx.arc(ex, hy + cell * 0.3, eye, 0, Math.PI * 2);
        ctx.arc(ex, hy + cell * 0.7, eye, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const ey = st.dir === "down" ? hy + cell * 0.7 : hy + cell * 0.3;
        ctx.beginPath();
        ctx.arc(hx + cell * 0.3, ey, eye, 0, Math.PI * 2);
        ctx.arc(hx + cell * 0.7, ey, eye, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      if (lastTsRef.current) {
        const dt = now - lastTsRef.current;
        if (phaseRef.current === "playing") {
          accRef.current += dt;
          const interval = tickIntervalMs(scoreRef.current);
          while (accRef.current >= interval) {
            accRef.current -= interval;
            const r = step(stateRef.current);
            if (r.ate) {
              scoreRef.current += 1;
              setScore(scoreRef.current);
            }
            if (!stateRef.current.alive) {
              endGame();
              break;
            }
          }
        }
      }
      lastTsRef.current = now;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endGame]);

  // 键盘控制
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (DIR_KEYS[e.key]) {
        e.preventDefault();
        setDirection(DIR_KEYS[e.key]);
      } else if (e.key === " " || e.key.toLowerCase() === "p") {
        e.preventDefault();
        togglePause();
      } else if (e.key === "Enter") {
        if (phaseRef.current === "ready" || phaseRef.current === "ended") startGame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDirection, togglePause, startGame]);

  // 触摸滑动
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    touchRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!touchRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - touchRef.current.x;
      const dy = y - touchRef.current.y;
      touchRef.current = null;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
      if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? "right" : "left");
      else setDirection(dy > 0 ? "down" : "up");
    },
    [setDirection],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部数据栏 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="得分" value={String(score)} highlight />
        <Stat label="本机最高分" value={String(best)} />
        <div className="hidden items-center justify-end sm:flex">
          {phase === "playing" && (
            <button
              onClick={togglePause}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
              aria-label="暂停"
            >
              <Pause className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 画布区 */}
      <div
        ref={wrapperRef}
        className="relative h-[440px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b11] shadow-xl sm:h-[520px]"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        />

        {/* 准备 */}
        {phase === "ready" && (
          <Overlay>
            <h2 className="text-2xl font-bold sm:text-3xl">贪吃蛇</h2>
            <p className="mt-1 text-sm text-zinc-400">吃豆变长，别撞墙、别咬到自己</p>
            <button
              onClick={startGame}
              className="mt-4 rounded-full bg-green-500 px-10 py-3 font-bold text-black transition hover:bg-green-400"
            >
              开始游戏
            </button>
          </Overlay>
        )}

        {/* 暂停 */}
        {phase === "paused" && (
          <Overlay transparent>
            <Play className="h-10 w-10 text-green-400" />
            <p className="mt-2 text-lg font-semibold">已暂停</p>
            <button
              onClick={togglePause}
              className="mt-4 rounded-full bg-green-500 px-8 py-2.5 font-bold text-black transition hover:bg-green-400"
            >
              继续
            </button>
          </Overlay>
        )}

        {/* 结束 */}
        {phase === "ended" && (
          <Overlay>
            <h2 className="text-xl font-bold text-zinc-300">游戏结束</h2>
            <div className="mt-1 text-5xl font-black text-green-400">{score}</div>
            <div className="text-sm text-zinc-400">
              本机最高分：<span className="font-semibold text-zinc-200">{best}</span>
            </div>
            <div className="mt-2 h-6 text-sm">
              {submitState === "saving" && <span className="text-zinc-400">正在保存成绩…</span>}
              {submitState === "saved" && <span className="text-emerald-400">✓ 成绩已保存到排行榜</span>}
              {submitState === "error" && <span className="text-red-400">{submitError}</span>}
              {submitState === "need-login" && <span className="text-zinc-400">登录后即可保存成绩</span>}
            </div>
            <button
              onClick={startGame}
              className="mt-4 rounded-full bg-green-500 px-10 py-3 font-bold text-black transition hover:bg-green-400"
            >
              再来一局
            </button>
          </Overlay>
        )}
      </div>

      {/* 屏幕方向键（移动端友好） */}
      <div className="mx-auto grid grid-cols-3 gap-2">
        <div />
        <DirBtn label="▲" onPress={() => setDirection("up")} />
        <div />
        <DirBtn label="◀" onPress={() => setDirection("left")} />
        <DirBtn label="▼" onPress={() => setDirection("down")} />
        <DirBtn label="▶" onPress={() => setDirection("right")} />
      </div>

      <p className="text-center text-xs text-zinc-500">
        键盘方向键 / WASD 控制 · 手机可滑动或点屏幕方向键 · 空格/ P 暂停
      </p>
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function Overlay({
  children,
  transparent = false,
}: {
  children: React.ReactNode;
  transparent?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center",
        transparent ? "bg-black/30" : "bg-black/70 backdrop-blur-sm",
      )}
    >
      {children}
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center">
      <div className="text-[10px] text-zinc-400">{label}</div>
      <div className={cn("text-lg font-bold leading-tight", highlight ? "text-green-400" : "text-zinc-100")}>
        {value}
      </div>
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
