import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Difficulty } from "@/types";

/** 合并 Tailwind class，自动去重冲突。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "简单",
  normal: "普通",
  hard: "困难",
};

/** 命中率显示，例如 0.666 -> "67%"。 */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "0%";
  return `${Math.round(ratio * 100)}%`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 取用户名展示值（未设置时回退为可读占位）。 */
export function displayName(username: string | null | undefined): string {
  if (username && username.trim()) return username.trim();
  return "匿名玩家";
}
