import type { Difficulty } from "@/types";

/**
 * 游戏注册表：新增小游戏只需在这里登记元数据，并在对应页面按 slug 动态加载组件。
 * 无需改动首页、导航或排行榜等外围代码。
 */
export interface GameDefinition {
  id: string;
  title: string;
  slug: string;
  description: string;
  emoji: string;
  /** 卡片上的渐变点缀（Tailwind class）。 */
  accent: string;
  available: boolean;
  /** 是否作为首页独立专区展示（不出现在普通游戏网格里）。 */
  featured?: boolean;
  difficulty: Difficulty[];
}

export const GAMES: GameDefinition[] = [
  {
    id: "basketball",
    title: "投篮挑战",
    slug: "basketball",
    description: "60 秒限时投篮，挑战你的命中率与连击！",
    emoji: "🏀",
    accent: "from-orange-500/25 via-orange-500/5 to-transparent",
    available: true,
    difficulty: ["easy", "normal", "hard"],
  },
  {
    id: "snake",
    title: "贪吃蛇",
    slug: "snake",
    description: "经典贪吃蛇，吃豆变长，挑战更高分！",
    emoji: "🐍",
    accent: "from-green-500/25 via-green-500/5 to-transparent",
    available: true,
    difficulty: ["easy", "normal", "hard"],
  },
  {
    id: "2048",
    title: "2048",
    slug: "2048",
    description: "合并数字方块，冲击 2048！",
    emoji: "🔢",
    accent: "from-yellow-500/25 via-yellow-500/5 to-transparent",
    available: true,
    difficulty: [],
  },
  {
    id: "memory",
    title: "记忆翻牌",
    slug: "memory",
    description: "翻开卡片，找出所有配对，越少步数越好！",
    emoji: "🃏",
    accent: "from-purple-500/25 via-purple-500/5 to-transparent",
    available: true,
    difficulty: [],
  },
  {
    id: "pong",
    title: "Pong",
    slug: "pong",
    description: "经典乒乓球对打，让 AI 接不住！",
    emoji: "🏓",
    accent: "from-cyan-500/25 via-cyan-500/5 to-transparent",
    available: true,
    difficulty: [],
  },
  {
    id: "reaction",
    title: "点击反应",
    slug: "reaction",
    description: "等变绿了立刻点击，测试你的反应速度！",
    emoji: "⚡",
    accent: "from-red-500/25 via-red-500/5 to-transparent",
    available: true,
    difficulty: [],
  },
  {
    id: "racing",
    title: "赛车",
    slug: "racing",
    description: "左右躲避来车，活得越久分越高！",
    emoji: "🏎️",
    accent: "from-slate-500/25 via-slate-500/5 to-transparent",
    available: true,
    difficulty: [],
  },
  {
    id: "forest",
    title: "森林里好像有什么",
    slug: "forest",
    description: "我只是来捡几根树枝的。",
    emoji: "🌲",
    accent: "from-green-700/30 via-green-600/5 to-transparent",
    available: true,
    difficulty: [],
    featured: true,
  },
];

export function getGameBySlug(slug: string): GameDefinition | undefined {
  return GAMES.find((g) => g.slug === slug);
}
