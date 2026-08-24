// Pong 纯逻辑引擎（固定逻辑坐标系 400×600）。
export const W = 400;
export const H = 600;
export const BALL_R = 8;
export const PADDLE_H = 90;
export const PADDLE_W = 12;
export const PADDLE_X = 24;
const BASE_SPEED = 320;

export interface PongState {
  ball: { x: number; y: number; vx: number; vy: number };
  playerY: number;
  aiY: number;
  score: number;
  over: boolean;
}

export function createPong(): PongState {
  return {
    ball: { x: W / 2, y: H / 2, vx: BASE_SPEED, vy: 120 },
    playerY: H / 2,
    aiY: H / 2,
    score: 0,
    over: false,
  };
}

export function setPlayerY(s: PongState, y: number): void {
  s.playerY = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, y));
}

export function step(s: PongState, dt: number): { scored: boolean; over: boolean } {
  if (s.over) return { scored: false, over: true };
  const b = s.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // 上下墙
  if (b.y - BALL_R < 0) {
    b.y = BALL_R;
    b.vy = Math.abs(b.vy);
  } else if (b.y + BALL_R > H) {
    b.y = H - BALL_R;
    b.vy = -Math.abs(b.vy);
  }

  // 玩家（左）拍
  if (
    b.vx < 0 &&
    b.x - BALL_R <= PADDLE_X + PADDLE_W &&
    b.y >= s.playerY - PADDLE_H / 2 - BALL_R &&
    b.y <= s.playerY + PADDLE_H / 2 + BALL_R
  ) {
    b.x = PADDLE_X + PADDLE_W + BALL_R;
    b.vx = Math.abs(b.vx) + 20;
    b.vy = ((b.y - s.playerY) / (PADDLE_H / 2)) * 260 || 60;
  }

  // AI（右）拍
  if (
    b.vx > 0 &&
    b.x + BALL_R >= W - PADDLE_X - PADDLE_W &&
    b.y >= s.aiY - PADDLE_H / 2 - BALL_R &&
    b.y <= s.aiY + PADDLE_H / 2 + BALL_R
  ) {
    b.x = W - PADDLE_X - PADDLE_W - BALL_R;
    b.vx = -(Math.abs(b.vx) + 20);
    b.vy = ((b.y - s.aiY) / (PADDLE_H / 2)) * 260 || -60;
  }

  // AI 跟踪球
  const target = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, b.y));
  const diff = target - s.aiY;
  s.aiY += Math.sign(diff) * Math.min(Math.abs(diff), 210 * dt);

  // 越过 AI（右）→ 玩家得分
  if (b.x > W + 20) {
    s.score += 1;
    serve(s, -1);
    return { scored: true, over: false };
  }
  // 越过玩家（左）→ 游戏结束
  if (b.x < -20) {
    s.over = true;
    return { scored: false, over: true };
  }
  return { scored: false, over: false };
}

function serve(s: PongState, dir: number): void {
  s.ball = {
    x: W / 2,
    y: Math.random() * H * 0.6 + H * 0.2,
    vx: dir * BASE_SPEED,
    vy: (Math.random() - 0.5) * 240,
  };
}
