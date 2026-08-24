import type { Difficulty } from "@/types";

export const GAME_DURATION_SECONDS = 60;
export const SCORE_PER_SHOT = 2;
export const COUNTDOWN_SECONDS = 3;

export interface DifficultyConfig {
  label: string;
  /** 篮筐正弦移动频率（rad/s）。0 表示固定不动。 */
  hoopFrequency: number;
  /** 篮筐左右摆动幅度（相对画布宽度的比例）。 */
  hoopAmplitude: number;
  /** 篮筐开口半宽缩放，越小越难。 */
  rimScale: number;
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { label: "简单", hoopFrequency: 0, hoopAmplitude: 0, rimScale: 1 },
  normal: { label: "普通", hoopFrequency: 0.9, hoopAmplitude: 0.12, rimScale: 0.86 },
  hard: { label: "困难", hoopFrequency: 1.7, hoopAmplitude: 0.16, rimScale: 0.7 },
};

/** 物理常量（px/s²、px、px/s）。可按手感调整。 */
export const GRAVITY = 1600;
export const LAUNCH_FACTOR = 9; // 拖拽向量(px) -> 初速度(px/s)
export const MAX_DRAG = 260; // 拖拽最大有效长度(px)
export const MIN_LAUNCH_SPEED = 170; // 低于该速度视为未出手
