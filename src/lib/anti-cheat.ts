// 服务端防作弊工具，仅可被 API 路由引用（不要在前端 bundle 中引入）。
// 设计原则：不信任客户端提交的 score；score 由服务端根据游戏规则重新计算或校验。
import { createHmac, timingSafeEqual } from "crypto";
import type { Difficulty } from "@/types";

export const SCORE_PER_SHOT = 2;
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

// 投篮挑战
export const MAX_SHOTS = 120;
export const MAX_STREAK = 120;
export const BASKETBALL_MIN_SECONDS = 45;
export const BASKETBALL_MAX_SECONDS = 90;

// 贪吃蛇
export const MAX_SNAKE_SCORE = 400; // 20×20 棋盘的理论最大值
export const SNAKE_MIN_SECONDS = 5;
export const SNAKE_MAX_SECONDS = 7200; // 2 小时

export type GameId = "basketball" | "snake";

interface GameTokenPayload {
  gameId: GameId;
  startedAt: number; // epoch 毫秒
  difficulty?: Difficulty;
}

function secret(): string {
  const s = process.env.ANTI_CHEAT_SECRET;
  if (!s) throw new Error("ANTI_CHEAT_SECRET 未配置");
  return s;
}

/** 开始游戏时签发带签名的令牌，记录开始时间。 */
export function signGameToken(payload: GameTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** 校验令牌签名与结构，返回载荷或 null。 */
export function verifyGameToken(token: string): GameTokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = createHmac("sha256", secret()).update(body).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as GameTokenPayload;
    if (typeof parsed.gameId !== "string" || typeof parsed.startedAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface ScoreSubmission {
  gameToken: string;
  // 投篮挑战
  shots?: number;
  madeShots?: number;
  maxStreak?: number;
  difficulty?: Difficulty;
  // 贪吃蛇
  score?: number;
}

export interface NormalizedScore {
  gameId: GameId;
  score: number;
  shots: number;
  madeShots: number;
  accuracy: number | null;
  maxStreak: number;
  difficulty: Difficulty | null;
}

export type ValidationResult =
  | { ok: true; data: NormalizedScore }
  | { ok: false; error: string };

/** 校验一次成绩提交，按令牌中的 gameId 分派到对应规则。 */
export function validateScoreSubmission(
  input: ScoreSubmission,
  now = Date.now(),
): ValidationResult {
  const token = verifyGameToken(input.gameToken);
  if (!token) return { ok: false, error: "游戏凭证无效，请重新开始游戏。" };

  const elapsed = (now - token.startedAt) / 1000;

  if (token.gameId === "basketball") {
    return validateBasketball(input, token, elapsed);
  }
  if (token.gameId === "snake") {
    return validateSnake(input, token, elapsed);
  }
  return { ok: false, error: "未知的游戏类型。" };
}

function validateBasketball(
  input: ScoreSubmission,
  token: GameTokenPayload,
  elapsed: number,
): ValidationResult {
  if (!DIFFICULTIES.includes(input.difficulty as Difficulty)) {
    return { ok: false, error: "难度参数无效。" };
  }
  if (token.difficulty !== input.difficulty) {
    return { ok: false, error: "难度信息不一致。" };
  }
  if (elapsed < BASKETBALL_MIN_SECONDS || elapsed > BASKETBALL_MAX_SECONDS) {
    return { ok: false, error: "游戏时长异常，成绩未保存。" };
  }

  const shots = input.shots;
  const madeShots = input.madeShots;
  const maxStreak = input.maxStreak;
  if (
    !Number.isInteger(shots) ||
    !Number.isInteger(madeShots) ||
    !Number.isInteger(maxStreak)
  ) {
    return { ok: false, error: "成绩数据格式异常。" };
  }
  if ((shots as number) < 0 || (madeShots as number) < 0 || (maxStreak as number) < 0) {
    return { ok: false, error: "成绩数据异常。" };
  }
  if ((shots as number) > MAX_SHOTS) {
    return { ok: false, error: "投篮次数超出合理范围。" };
  }
  if ((madeShots as number) > (shots as number)) {
    return { ok: false, error: "命中次数不能大于投篮次数。" };
  }
  if ((maxStreak as number) > (madeShots as number)) {
    return { ok: false, error: "连中次数异常。" };
  }
  if ((maxStreak as number) > MAX_STREAK) {
    return { ok: false, error: "连中次数超出合理范围。" };
  }

  const s = shots as number;
  const m = madeShots as number;
  const accuracy = s > 0 ? Math.round((m / s) * 10000) / 10000 : 0;
  const score = m * SCORE_PER_SHOT;

  return {
    ok: true,
    data: {
      gameId: "basketball",
      score,
      shots: s,
      madeShots: m,
      accuracy,
      maxStreak: maxStreak as number,
      difficulty: input.difficulty as Difficulty,
    },
  };
}

function validateSnake(
  input: ScoreSubmission,
  token: GameTokenPayload,
  elapsed: number,
): ValidationResult {
  if (elapsed < SNAKE_MIN_SECONDS || elapsed > SNAKE_MAX_SECONDS) {
    return { ok: false, error: "游戏时长异常，成绩未保存。" };
  }
  if (!DIFFICULTIES.includes(input.difficulty as Difficulty)) {
    return { ok: false, error: "难度参数无效。" };
  }
  if (token.difficulty !== input.difficulty) {
    return { ok: false, error: "难度信息不一致。" };
  }
  const score = input.score;
  if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > MAX_SNAKE_SCORE) {
    return { ok: false, error: "得分数据异常。" };
  }
  return {
    ok: true,
    data: {
      gameId: "snake",
      score: score as number,
      shots: 0,
      madeShots: 0,
      accuracy: null,
      maxStreak: 0,
      difficulty: input.difficulty as Difficulty,
    },
  };
}
