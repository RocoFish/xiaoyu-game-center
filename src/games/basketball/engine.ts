// 投篮挑战的纯物理/逻辑引擎：不依赖 DOM，便于单元测试与复用。
import { DIFFICULTY_CONFIG, GRAVITY } from "./constants";
import type { Difficulty } from "@/types";

export interface Court {
  width: number;
  height: number;
  ballRadius: number;
  launchX: number;
  launchY: number;
  rimBaseX: number;
  rimY: number;
  rimHalfWidth: number;
  floorY: number;
  backboardX: number;
  backboardTop: number;
  backboardBottom: number;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  prevY: number;
  active: boolean;
}

export interface StepEvents {
  scored: boolean;
  bounced: "none" | "rim" | "backboard" | "floor";
  settled: boolean;
}

/** 依据画布尺寸与难度生成球场布局。 */
export function createCourt(
  width: number,
  height: number,
  difficulty: Difficulty,
): Court {
  const L = Math.min(width, height);
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const ballRadius = 0.03 * L;
  const rimHalfWidth = ballRadius * 1.7 * cfg.rimScale;
  const rimBaseX = width * 0.74;
  return {
    width,
    height,
    ballRadius,
    launchX: width * 0.16,
    launchY: height * 0.84,
    rimBaseX,
    rimY: height * 0.3,
    rimHalfWidth,
    floorY: height * 0.92,
    backboardX: rimBaseX + rimHalfWidth + ballRadius * 0.5,
    backboardTop: height * 0.21,
    backboardBottom: height * 0.39,
  };
}

/** 计算当前帧篮筐中心 x（Normal/Hard 会随时间摆动）。 */
export function rimCenterX(court: Court, elapsed: number, difficulty: Difficulty): number {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  if (cfg.hoopFrequency === 0) return court.rimBaseX;
  return (
    court.rimBaseX +
    Math.sin(elapsed * cfg.hoopFrequency) * cfg.hoopAmplitude * court.width
  );
}

export function createBall(court: Court): BallState {
  return {
    x: court.launchX,
    y: court.launchY,
    vx: 0,
    vy: 0,
    prevY: court.launchY,
    active: false,
  };
}

/** 推进一帧物理，返回本帧发生的事件。 */
export function stepBall(
  ball: BallState,
  court: Court,
  rimX: number,
  dt: number,
): StepEvents {
  const r = court.ballRadius;
  ball.prevY = ball.y;
  ball.vy += GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  let scored = false;
  let bounced: StepEvents["bounced"] = "none";
  let settled = false;

  // 左右墙与顶墙：保证球始终在画面内。
  if (ball.x - r < 0) {
    ball.x = r;
    ball.vx = Math.abs(ball.vx) * 0.6;
  } else if (ball.x + r > court.width) {
    ball.x = court.width - r;
    ball.vx = -Math.abs(ball.vx) * 0.6;
  }
  if (ball.y - r < 0) {
    ball.y = r;
    ball.vy = Math.abs(ball.vy) * 0.6;
  }

  // 篮板（篮筐右侧竖直板）：向右飞且触板时反弹。
  if (
    ball.vx > 0 &&
    ball.x + r >= court.backboardX &&
    ball.y >= court.backboardTop &&
    ball.y <= court.backboardBottom
  ) {
    ball.x = court.backboardX - r;
    ball.vx = -ball.vx * 0.7;
    bounced = "backboard";
  }

  // 篮筐左右两缘的碰撞反弹。
  const edges = [rimX - court.rimHalfWidth, rimX + court.rimHalfWidth];
  for (const ex of edges) {
    const dx = ball.x - ex;
    const dy = ball.y - court.rimY;
    const dist2 = dx * dx + dy * dy;
    if (dist2 <= r * r) {
      const dist = Math.sqrt(dist2) || 0.0001;
      ball.x = ex + (dx / dist) * r;
      ball.y = court.rimY + (dy / dist) * r;
      const nx = dx / dist;
      const ny = dy / dist;
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
      }
      ball.vx *= 0.62;
      ball.vy *= 0.62;
      bounced = "rim";
      break;
    }
  }

  // 命中：球心自上而下穿过篮筐平面，且落在开口范围内。
  if (ball.prevY <= court.rimY && ball.y > court.rimY && ball.vy > 0) {
    if (Math.abs(ball.x - rimX) < court.rimHalfWidth) {
      scored = true;
    }
  }

  // 地面：减速到阈值后停稳，表示本次投篮结束。
  if (ball.y + r >= court.floorY) {
    ball.y = court.floorY - r;
    if (Math.abs(ball.vy) < 60) {
      ball.vy = 0;
      ball.vx = 0;
      settled = true;
    } else {
      ball.vy = -ball.vy * 0.5;
      ball.vx *= 0.8;
      bounced = "floor";
    }
  }

  return { scored, bounced, settled };
}

/** 生成瞄准时的轨迹预览点。 */
export function simulateTrajectory(
  court: Court,
  vx: number,
  vy: number,
  steps = 26,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  let x = court.launchX;
  let y = court.launchY;
  let cvx = vx;
  let cvy = vy;
  const dt = 1 / 60;
  for (let i = 0; i < steps; i++) {
    cvy += GRAVITY * dt;
    x += cvx * dt;
    y += cvy * dt;
    if (y > court.floorY) break;
    pts.push({ x, y });
  }
  return pts;
}
