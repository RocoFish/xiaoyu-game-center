"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn, DIFFICULTY_LABEL } from "@/lib/utils";
import type { Difficulty, GameResult } from "@/types";
import {
  COUNTDOWN_SECONDS,
  DIFFICULTY_CONFIG,
  GAME_DURATION_SECONDS,
  LAUNCH_FACTOR,
  MAX_DRAG,
  MIN_LAUNCH_SPEED,
  SCORE_PER_SHOT,
} from "./constants";
import {
  createBall,
  createCourt,
  rimCenterX,
  simulateTrajectory,
  stepBall,
  type BallState,
  type Court,
} from "./engine";

type Phase = "ready" | "countdown" | "playing" | "ended";
type SubmitState = "idle" | "saving" | "saved" | "error" | "need-login";

interface Hud {
  score: number;
  shots: number;
  made: number;
  streak: number;
  maxStreak: number;
  timeLeft: number;
}

interface Feedback {
  id: number;
  text: string;
  kind: "score" | "streak" | "miss";
}

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "normal", "hard"];

export function BasketballGame() {
  const { user } = useAuth();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const courtRef = useRef<Court | null>(null);
  const ballRef = useRef<BallState | null>(null);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);

  const phaseRef = useRef<Phase>("ready");
  const difficultyRef = useRef<Difficulty>("easy");
  const countdownStartRef = useRef<number>(0);
  const playingStartRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const aimRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const hudRef = useRef<Hud>({
    score: 0,
    shots: 0,
    made: 0,
    streak: 0,
    maxStreak: 0,
    timeLeft: GAME_DURATION_SECONDS,
  });
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef(user);
  const resultRef = useRef<GameResult | null>(null);
  const submittedRef = useRef<boolean>(false);
  const countdownLabelRef = useRef<string>("");
  const shotScoredRef = useRef<boolean>(false);

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [countdown, setCountdown] = useState<string>("3");
  const [hud, setHud] = useState<Hud>(hudRef.current);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string>("");
  const [result, setResult] = useState<GameResult | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const syncHud = useCallback(() => {
    setHud({ ...hudRef.current });
  }, []);

  const pushFeedback = useCallback((text: string, kind: Feedback["kind"]) => {
    setFeedback({ id: Date.now() + Math.random(), text, kind });
  }, []);

  // 依据容器尺寸初始化 / 更新画布与球场布局。
  const updateCanvasSize = useCallback(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    courtRef.current = createCourt(w, h, difficultyRef.current);
    if (ballRef.current && courtRef.current) {
      ballRef.current = createBall(courtRef.current);
    } else if (courtRef.current) {
      ballRef.current = createBall(courtRef.current);
    }
  }, []);

  useEffect(() => {
    updateCanvasSize();
    const ro = new ResizeObserver(() => updateCanvasSize());
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [updateCanvasSize]);

  const resetBall = useCallback(() => {
    if (courtRef.current) {
      ballRef.current = createBall(courtRef.current);
    }
  }, []);

  const resetStats = useCallback(() => {
    hudRef.current = {
      score: 0,
      shots: 0,
      made: 0,
      streak: 0,
      maxStreak: 0,
      timeLeft: GAME_DURATION_SECONDS,
    };
    setHud({ ...hudRef.current });
  }, []);

  // 领取带签名的游戏令牌（仅登录用户）。
  const requestToken = useCallback(async (diff: Difficulty) => {
    tokenRef.current = null;
    if (!userRef.current) return;
    try {
      const res = await fetch("/api/games/basketball/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: diff }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.token) tokenRef.current = data.token;
      }
    } catch {
      // 领取失败则视为未登录，结束时不提交成绩。
    }
  }, []);

  const startGame = useCallback(
    (diff: Difficulty) => {
      difficultyRef.current = diff;
      setDifficulty(diff);
      resetStats();
      resetBall();
      resultRef.current = null;
      submittedRef.current = false;
      setResult(null);
      setSubmitState("idle");
      setSubmitError("");
      setFeedback(null);
      // 用当前尺寸重建球场（篮筐半宽会随难度变化）。
      updateCanvasSize();
      void requestToken(diff);
      countdownStartRef.current = performance.now();
      setPhase("countdown");
    },
    [resetStats, resetBall, updateCanvasSize, requestToken, setPhase],
  );

  const beginPlaying = useCallback(() => {
    playingStartRef.current = performance.now();
    elapsedRef.current = 0;
    hudRef.current.timeLeft = GAME_DURATION_SECONDS;
    setPhase("playing");
  }, [setPhase]);

  const finishGame = useCallback(() => {
    const h = hudRef.current;
    const resultValue: GameResult = {
      score: h.score,
      shots: h.shots,
      madeShots: h.made,
      accuracy: h.shots > 0 ? h.made / h.shots : 0,
      maxStreak: h.maxStreak,
      difficulty: difficultyRef.current,
    };
    resultRef.current = resultValue;
    setResult(resultValue);
    setPhase("ended");
    void submitScore(resultValue);
  }, [setPhase]);

  const submitScore = useCallback(
    async (r: GameResult) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      if (!userRef.current || !tokenRef.current) {
        setSubmitState("need-login");
        return;
      }
      setSubmitState("saving");
      try {
        const res = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameToken: tokenRef.current,
            shots: r.shots,
            madeShots: r.madeShots,
            maxStreak: r.maxStreak,
            difficulty: r.difficulty,
          }),
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

  // 投篮命中 / 未命中的统计与反馈。
  const onScored = useCallback(() => {
    hudRef.current.made += 1;
    hudRef.current.score += SCORE_PER_SHOT;
    hudRef.current.streak += 1;
    hudRef.current.maxStreak = Math.max(hudRef.current.maxStreak, hudRef.current.streak);
    const s = hudRef.current.streak;
    if (s >= 3) {
      pushFeedback(`🔥 ${s} 连中！`, "streak");
    } else {
      pushFeedback(`SWISH! +${SCORE_PER_SHOT}`, "score");
    }
    syncHud();
  }, [pushFeedback, syncHud]);

  const onMissed = useCallback(() => {
    hudRef.current.streak = 0;
    syncHud();
  }, [syncHud]);

  const launchBall = useCallback(() => {
    const aim = aimRef.current;
    const ball = ballRef.current;
    const court = courtRef.current;
    if (!aim || !ball || !court) return;
    let dx = aim.sx - aim.cx;
    let dy = aim.sy - aim.cy;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    if (len > MAX_DRAG) {
      dx = (dx / len) * MAX_DRAG;
      dy = (dy / len) * MAX_DRAG;
    }
    const speed = len * LAUNCH_FACTOR;
    if (speed < MIN_LAUNCH_SPEED) return;
    ball.vx = dx * LAUNCH_FACTOR;
    ball.vy = dy * LAUNCH_FACTOR;
    ball.active = true;
    shotScoredRef.current = false;
    hudRef.current.shots += 1;
    syncHud();
  }, [syncHud]);

  // 主循环：倒计时 / 计时 + 物理推进 + 绘制。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (now: number) => {
      const court = courtRef.current;
      const ball = ballRef.current;
      if (!court || !ball) return;
      const w = court.width;
      const h = court.height;

      // 球场背景
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#14141c");
      bg.addColorStop(1, "#0b0b11");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 地板
      ctx.strokeStyle = "rgba(249,115,22,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, court.floorY);
      ctx.lineTo(w, court.floorY);
      ctx.stroke();

      // 篮筐中心（准备/倒计时/结束阶段静止，游戏中移动）
      const isPlaying = phaseRef.current === "playing";
      const rimX = isPlaying
        ? rimCenterX(court, elapsedRef.current, difficultyRef.current)
        : court.rimBaseX;

      // 篮板
      const boardW = court.ballRadius * 0.7;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(court.backboardX, court.backboardTop, boardW, court.backboardBottom - court.backboardTop);
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.strokeRect(court.backboardX, court.backboardTop, boardW, court.backboardBottom - court.backboardTop);
      // 篮板内框
      ctx.strokeStyle = "rgba(249,115,22,0.6)";
      ctx.lineWidth = 1.5;
      const sqW = boardW + court.ballRadius * 0.4;
      ctx.strokeRect(court.backboardX - sqW * 0.2, court.rimY - court.ballRadius * 1.3, sqW * 0.4, court.ballRadius * 2.6);

      // 篮筐（开口 + 网）
      const rimThick = court.ballRadius * 0.28;
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = rimThick;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(rimX - court.rimHalfWidth, court.rimY);
      ctx.lineTo(rimX + court.rimHalfWidth, court.rimY);
      ctx.stroke();
      // 网
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.2;
      const netTop = court.rimY;
      const netBot = court.rimY + court.ballRadius * 2.4;
      const netSegs = 6;
      for (let i = 0; i <= netSegs; i++) {
        const x0 = rimX - court.rimHalfWidth + ((2 * court.rimHalfWidth) * i) / netSegs;
        const x1 = rimX - court.rimHalfWidth * 0.55 + (court.rimHalfWidth * 1.1 * i) / netSegs;
        ctx.beginPath();
        ctx.moveTo(x0, netTop);
        ctx.lineTo(x1, netBot);
        ctx.stroke();
      }

      // 瞄准轨迹预览
      if (aimRef.current && isPlaying && !ball.active) {
        const a = aimRef.current;
        let dx = a.sx - a.cx;
        let dy = a.sy - a.cy;
        const len = Math.hypot(dx, dy);
        if (len >= 1) {
          if (len > MAX_DRAG) {
            dx = (dx / len) * MAX_DRAG;
            dy = (dy / len) * MAX_DRAG;
          }
          const pts = simulateTrajectory(court, dx * LAUNCH_FACTOR, dy * LAUNCH_FACTOR);
          ctx.fillStyle = "rgba(249,115,22,0.9)";
          pts.forEach((p, i) => {
            const alpha = 0.85 - (i / pts.length) * 0.6;
            ctx.globalAlpha = Math.max(alpha, 0.15);
            ctx.beginPath();
            ctx.arc(p.x, p.y, court.ballRadius * 0.22, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.globalAlpha = 1;
        }
      }

      // 篮球
      drawBall(ctx, ball.x, ball.y, court.ballRadius);

      // 出手方向指示线（瞄准时）
      if (aimRef.current && isPlaying && !ball.active) {
        const a = aimRef.current;
        ctx.strokeStyle = "rgba(249,115,22,0.5)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(a.cx, a.cy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    const loop = (now: number) => {
      const dt = lastTsRef.current ? Math.min((now - lastTsRef.current) / 1000, 0.05) : 0;
      lastTsRef.current = now;

      const p = phaseRef.current;

      if (p === "countdown") {
        const since = (now - countdownStartRef.current) / 1000;
        const total = COUNTDOWN_SECONDS + 1;
        if (since >= total) {
          beginPlaying();
        } else {
          const remaining = total - since;
          const label =
            remaining > COUNTDOWN_SECONDS
              ? "3"
              : remaining > COUNTDOWN_SECONDS - 1
                ? "2"
                : remaining > COUNTDOWN_SECONDS - 2
                  ? "1"
                  : "GO!";
          if (label !== countdownLabelRef.current) {
            countdownLabelRef.current = label;
            setCountdown(label);
          }
        }
      } else if (p === "playing") {
        const since = (now - playingStartRef.current) / 1000;
        elapsedRef.current = since;
        const timeLeft = GAME_DURATION_SECONDS - since;
        const t = Math.max(0, Math.ceil(timeLeft));
        if (t !== hudRef.current.timeLeft) {
          hudRef.current.timeLeft = t;
          syncHud();
        }
        if (timeLeft <= 0) {
          finishGame();
        } else {
          const ball = ballRef.current;
          const court = courtRef.current;
          if (ball && court && ball.active) {
            const rimX = rimCenterX(court, elapsedRef.current, difficultyRef.current);
            const ev = stepBall(ball, court, rimX, dt);
            if (ev.scored) {
              shotScoredRef.current = true;
              onScored();
            }
            if (ev.settled) {
              if (!shotScoredRef.current) onMissed();
              resetBall();
            }
          }
        }
      }

      draw(now);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 指针交互：拖拽瞄准 + 松手投篮。
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (phaseRef.current !== "playing") return;
      if (ballRef.current?.active) return;
      const rect = e.currentTarget.getBoundingClientRect();
      aimRef.current = { sx: e.clientX - rect.left, sy: e.clientY - rect.top, cx: e.clientX - rect.left, cy: e.clientY - rect.top };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    aimRef.current.cx = e.clientX - rect.left;
    aimRef.current.cy = e.clientY - rect.top;
  }, []);

  const onPointerUp = useCallback(() => {
    if (!aimRef.current) return;
    if (phaseRef.current === "playing" && !ballRef.current?.active) {
      launchBall();
    }
    aimRef.current = null;
  }, [launchBall]);

  const accuracy = hud.shots > 0 ? hud.made / hud.shots : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部数据栏 */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="得分" value={String(hud.score)} highlight />
        <Stat label="时间" value={`${hud.timeLeft}s`} />
        <Stat label="投篮" value={String(hud.shots)} />
        <Stat label="命中" value={String(hud.made)} />
        <Stat label="命中率" value={`${Math.round(accuracy * 100)}%`} />
        <Stat label="最高连中" value={`${hud.maxStreak}`} />
      </div>

      {/* 游戏画布区 */}
      <div
        ref={wrapperRef}
        className="relative h-[440px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b11] shadow-xl sm:h-[540px] lg:h-[600px]"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {/* 连击指示 */}
        {hud.streak >= 3 && phase === "playing" && (
          <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-orange-500/20 px-4 py-1 text-lg font-bold text-orange-300 backdrop-blur">
            🔥 {hud.streak} 连中
          </div>
        )}

        {/* 得分反馈 */}
        {feedback && phase === "playing" && (
          <div
            key={feedback.id}
            className={cn(
              "pointer-events-none absolute left-1/2 top-1/4 -translate-x-1/2 text-4xl font-black drop-shadow-lg animate-feedback",
              feedback.kind === "miss" ? "text-white/80" : "text-orange-400",
            )}
          >
            {feedback.text}
          </div>
        )}

        {/* 准备阶段 */}
        {phase === "ready" && (
          <Overlay>
            <h2 className="text-2xl font-bold sm:text-3xl">选择难度</h2>
            <p className="text-sm text-zinc-400">每局 {GAME_DURATION_SECONDS} 秒，命中一球 +{SCORE_PER_SHOT} 分</p>
            <div className="mt-2 grid w-full max-w-sm grid-cols-3 gap-2">
              {DIFFICULTY_ORDER.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "rounded-xl border px-2 py-3 text-sm font-semibold transition",
                    difficulty === d
                      ? "border-orange-500 bg-orange-500/15 text-orange-300"
                      : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/25",
                  )}
                >
                  {DIFFICULTY_LABEL[d]}
                  <div className="mt-1 text-[10px] font-normal text-zinc-400">{DIFFICULTY_CONFIG[d].hoopFrequency === 0 ? "篮筐固定" : DIFFICULTY_CONFIG[d].hoopFrequency < 1.3 ? "轻微移动" : "快速移动"}</div>
                </button>
              ))}
            </div>
            <button onClick={() => startGame(difficulty)} className="mt-4 rounded-full bg-orange-500 px-10 py-3 font-bold text-black transition hover:bg-orange-400">
              开始游戏
            </button>
          </Overlay>
        )}

        {/* 倒计时 */}
        {phase === "countdown" && (
          <Overlay transparent>
            <div key={countdown} className="animate-countdown text-7xl font-black text-orange-400 drop-shadow-xl">
              {countdown}
            </div>
          </Overlay>
        )}

        {/* 结束阶段 */}
        {phase === "ended" && result && (
          <Overlay>
            <h2 className="text-xl font-bold text-zinc-300">时间到！</h2>
            <div className="mt-1 text-5xl font-black text-orange-400">{result.score}</div>
            <div className="text-sm text-zinc-400">最终得分</div>
            <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-2 text-sm">
              <ResultRow label="投篮" value={String(result.shots)} />
              <ResultRow label="命中" value={String(result.madeShots)} />
              <ResultRow label="命中率" value={`${Math.round(result.accuracy * 100)}%`} />
              <ResultRow label="最高连中" value={String(result.maxStreak)} />
            </div>
            <div className="mt-4 h-6 text-sm">
              {submitState === "saving" && <span className="text-zinc-400">正在保存成绩…</span>}
              {submitState === "saved" && <span className="text-emerald-400">✓ 成绩已保存到排行榜</span>}
              {submitState === "error" && <span className="text-red-400">{submitError}</span>}
              {submitState === "need-login" && <span className="text-zinc-400">登录后即可保存成绩</span>}
            </div>
            <div className="mt-2 flex gap-3">
              <button onClick={() => startGame(result.difficulty)} className="rounded-full bg-orange-500 px-8 py-3 font-bold text-black transition hover:bg-orange-400">
                再来一局
              </button>
              <button onClick={() => setPhase("ready")} className="rounded-full border border-white/15 px-6 py-3 font-semibold text-zinc-200 transition hover:bg-white/5">
                换难度
              </button>
            </div>
          </Overlay>
        )}
      </div>

      <p className="text-center text-xs text-zinc-500">
        按住屏幕任意位置向下拖动瞄准，松手投篮；拖得越远投得越远。
      </p>
    </div>
  );
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#f97316";
  ctx.fill();
  ctx.strokeStyle = "#7c2d12";
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.4, y - r * 0.4, r * 0.55, Math.PI * 0.1, Math.PI * 0.9);
  ctx.arc(x + r * 0.4, y + r * 0.4, r * 0.55, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.restore();
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
      <div className={cn("text-lg font-bold leading-tight", highlight ? "text-orange-400" : "text-zinc-100")}>
        {value}
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
      <span className="text-zinc-400">{label}</span>
      <span className="font-semibold text-zinc-100">{value}</span>
    </div>
  );
}
