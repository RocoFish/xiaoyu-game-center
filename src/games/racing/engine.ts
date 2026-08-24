// 赛车（躲避）纯逻辑引擎，固定逻辑坐标系 360×600。
export const W = 360;
export const H = 600;
export const LANES = 3;
export const LANE_W = W / LANES;
export const CAR_W = 70;
export const CAR_H = 50;
export const CAR_Y = H - 100;

export interface Obstacle {
  lane: number;
  y: number;
  w: number;
  h: number;
}

export interface RaceState {
  lane: number;
  obstacles: Obstacle[];
  spawnTimer: number;
  elapsed: number;
  score: number;
  over: boolean;
}

export function createRace(): RaceState {
  return { lane: 1, obstacles: [], spawnTimer: 0, elapsed: 0, score: 0, over: false };
}

export function move(s: RaceState, dir: -1 | 1): void {
  s.lane = Math.max(0, Math.min(LANES - 1, s.lane + dir));
}

export function step(s: RaceState, dt: number): void {
  if (s.over) return;
  s.elapsed += dt;
  s.score = Math.floor(s.elapsed * 10);

  // 生成障碍，随时间加快
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0) {
    s.spawnTimer = Math.max(0.42, 0.9 - s.elapsed * 0.012);
    const lane = Math.floor(Math.random() * LANES);
    s.obstacles.push({ lane, y: -CAR_H, w: CAR_W, h: CAR_H });
  }

  // 障碍下移
  const speed = 220 + s.elapsed * 2.2;
  for (const o of s.obstacles) o.y += speed * dt;
  s.obstacles = s.obstacles.filter((o) => o.y < H + 100);

  // 碰撞检测
  for (const o of s.obstacles) {
    if (o.lane === s.lane && o.y + o.h > CAR_Y && o.y < CAR_Y + CAR_H) {
      s.over = true;
      return;
    }
  }
}
