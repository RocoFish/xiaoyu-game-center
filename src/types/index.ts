// 全站共享的领域类型。

export type Difficulty = "easy" | "normal" | "hard";

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface GameScore {
  id: string;
  user_id: string;
  game_id: string;
  score: number;
  shots: number;
  made_shots: number;
  accuracy: number | null;
  max_streak: number;
  difficulty: Difficulty | null;
  played_at: string;
}

/** 排行榜一行：成绩 + 关联的用户资料（用户名 / 头像）。 */
export interface LeaderboardEntry extends GameScore {
  profiles: { username: string | null; avatar_url: string | null } | null;
  rank?: number;
}

/** 客户端一局游戏结束后的本地结果。 */
export interface GameResult {
  score: number;
  shots: number;
  madeShots: number;
  accuracy: number;
  maxStreak: number;
  difficulty: Difficulty;
}

/** 个人中心统计汇总。 */
export interface PlayerStats {
  totalGames: number;
  bestScore: number;
  bestAccuracy: number;
  bestStreak: number;
}
