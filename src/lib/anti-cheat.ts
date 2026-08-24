// 服务端防作弊工具，仅可被 API 路由引用（不要在前端 bundle 中引入）。
// 设计原则：不信任客户端提交的 score；score 由服务端根据 made_shots 重新计算。
import { createHmac, timingSafeEqual } from "crypto";
import type { Difficulty } from "@/types";

export const GAME_DURATION_SECONDS = 60;
export const SCORE_PER_SHOT = 2;

// 一局 60 秒，理论极限约 1 秒/球；此处留足冗余、仅拦截明显异常值。
export const MAX_SHOTS = 120;
export const MAX_STREAK = 120;
export const MIN_GAME_SECONDS = 45;
export const MAX_GAME_SECONDS = 90;

export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

interface GameTokenPayload {
  gameId: string;
  difficulty: Difficulty;
  startedAt: number; // epoch 毫秒
}

function secret(): string {
  const s = process.env.ANTI_CHEAT_SECRET;
  if (!s) throw new Error("ANTI_CHEAT_SECRET 未配置");
  return s;
}

/** 开始游戏时签发一个带签名的令牌，记录开始时间，用于提交时校验真实游戏时长。 */
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
    if (
      typeof parsed.gameId !== "string" ||
      typeof parsed.difficulty !== "string" ||
      typeof parsed.startedAt !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface ScoreSubmission {
  gameToken: string;
  shots: number;
  madeShots: number;
  maxStreak: number;
  difficulty: Difficulty;
}

export type ValidationResult =
  | {
      ok: true;
      data: {
        score: number;
        shots: number;
        madeShots: number;
        accuracy: number;
        maxStreak: number;
        difficulty: Difficulty;
      };
    }
  | { ok: false; error: string };

/**
 * 校验一次成绩提交。返回归一化后的数据，score 由此处重新计算。
 * 这是第一版防作弊边界；更彻底的方案（服务端校验整局 replay/遥测）在此预留扩展：
 * 后续可在游戏 token 中附带“投篮事件遥测流”，由服务端重放物理模拟来确认每一球。
 */
export function validateScoreSubmission(
  input: ScoreSubmission,
  now = Date.now(),
): ValidationResult {
  const token = verifyGameToken(input.gameToken);
  if (!token) return { ok: false, error: "游戏凭证无效，请重新开始游戏。" };
  if (token.gameId !== "basketball") {
    return { ok: false, error: "游戏凭证无效。" };
  }

  if (!DIFFICULTIES.includes(input.difficulty)) {
    return { ok: false, error: "难度参数无效。" };
  }
  if (token.difficulty !== input.difficulty) {
    return { ok: false, error: "难度信息不一致。" };
  }

  const elapsed = (now - token.startedAt) / 1000;
  if (elapsed < MIN_GAME_SECONDS || elapsed > MAX_GAME_SECONDS) {
    return { ok: false, error: "游戏时长异常，成绩未保存。" };
  }

  const { shots, madeShots, maxStreak } = input;
  if (
    !Number.isInteger(shots) ||
    !Number.isInteger(madeShots) ||
    !Number.isInteger(maxStreak)
  ) {
    return { ok: false, error: "成绩数据格式异常。" };
  }
  if (shots < 0 || madeShots < 0 || maxStreak < 0) {
    return { ok: false, error: "成绩数据异常。" };
  }
  if (shots > MAX_SHOTS) {
    return { ok: false, error: "投篮次数超出合理范围。" };
  }
  if (madeShots > shots) {
    return { ok: false, error: "命中次数不能大于投篮次数。" };
  }
  if (maxStreak > madeShots) {
    return { ok: false, error: "连中次数异常。" };
  }
  if (maxStreak > MAX_STREAK) {
    return { ok: false, error: "连中次数超出合理范围。" };
  }

  const accuracy = shots > 0 ? Math.round((madeShots / shots) * 10000) / 10000 : 0;
  const score = madeShots * SCORE_PER_SHOT;

  return {
    ok: true,
    data: {
      score,
      shots,
      madeShots,
      accuracy,
      maxStreak,
      difficulty: input.difficulty,
    },
  };
}
