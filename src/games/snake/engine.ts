// 贪吃蛇纯逻辑引擎：不依赖 DOM，便于测试与复用。
import type { Difficulty } from "@/types";

export const GRID = 20; // 20×20 网格

export type Direction = "up" | "down" | "left" | "right";
export type SnakeDifficulty = Difficulty; // easy | normal | hard

export interface Point {
  x: number;
  y: number;
}

export interface SnakeDifficultyConfig {
  label: string;
  baseTickMs: number; // 初始每步间隔
  speedupPerFood: number; // 每吃一个豆减少的间隔
  minTickMs: number; // 最快速度上限
  wrap: boolean; // 撞墙是否穿墙
}

export const SNAKE_DIFFICULTIES: Record<SnakeDifficulty, SnakeDifficultyConfig> = {
  easy: { label: "简单", baseTickMs: 200, speedupPerFood: 4, minTickMs: 120, wrap: true },
  normal: { label: "普通", baseTickMs: 150, speedupPerFood: 5, minTickMs: 80, wrap: false },
  hard: { label: "困难", baseTickMs: 110, speedupPerFood: 6, minTickMs: 60, wrap: false },
};

export const SNAKE_DIFFICULTY_ORDER: SnakeDifficulty[] = ["easy", "normal", "hard"];

export interface SnakeState {
  snake: Point[]; // 头在前
  food: Point;
  dir: Direction;
  nextDir: Direction; // 排队中的方向
  alive: boolean;
  score: number;
  difficulty: SnakeDifficulty;
}

const DX: Record<Direction, number> = { up: 0, down: 0, left: -1, right: 1 };
const DY: Record<Direction, number> = { up: -1, down: 1, left: 0, right: 0 };

export function opposite(d: Direction): Direction {
  switch (d) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

/** 每走一步的间隔（毫秒），随得分加快、按难度不同。 */
export function tickIntervalMs(score: number, difficulty: SnakeDifficulty): number {
  const c = SNAKE_DIFFICULTIES[difficulty];
  return Math.max(c.minTickMs, c.baseTickMs - score * c.speedupPerFood);
}

export function createGame(difficulty: SnakeDifficulty): SnakeState {
  const mid = Math.floor(GRID / 2);
  return {
    snake: [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ],
    food: { x: mid + 4, y: mid },
    dir: "right",
    nextDir: "right",
    alive: true,
    score: 0,
    difficulty,
  };
}

/** 尝试转向（不能瞬间掉头）。 */
export function queueDirection(s: SnakeState, dir: Direction): void {
  if (dir === opposite(s.dir)) return;
  s.nextDir = dir;
}

/** 推进一帧。返回是否吃到食物。 */
export function step(s: SnakeState): { ate: boolean } {
  if (s.nextDir !== opposite(s.dir)) {
    s.dir = s.nextDir;
  }

  const head = s.snake[0];
  let nx = head.x + DX[s.dir];
  let ny = head.y + DY[s.dir];

  const cfg = SNAKE_DIFFICULTIES[s.difficulty];
  if (cfg.wrap) {
    // 简单：穿墙
    if (nx < 0) nx = GRID - 1;
    else if (nx >= GRID) nx = 0;
    if (ny < 0) ny = GRID - 1;
    else if (ny >= GRID) ny = 0;
  } else {
    if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) {
      s.alive = false;
      return { ate: false };
    }
  }

  const ate = nx === s.food.x && ny === s.food.y;

  // 撞自己（不吃时尾巴会移开一格，故排除尾结点）
  const body = ate ? s.snake : s.snake.slice(0, -1);
  if (body.some((p) => p.x === nx && p.y === ny)) {
    s.alive = false;
    return { ate: false };
  }

  s.snake = [{ x: nx, y: ny }, ...s.snake];
  if (ate) {
    s.score += 1;
    spawnFood(s);
  } else {
    s.snake.pop();
  }
  return { ate };
}

function spawnFood(s: SnakeState): void {
  const occupied = new Set(s.snake.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) {
    s.alive = false; // 填满棋盘，视为通关
    return;
  }
  s.food = free[Math.floor(Math.random() * free.length)];
}
