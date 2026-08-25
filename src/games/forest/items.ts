// 森林物品定义（原创，程序生成图标用 emoji / 简单符号）
export type Rarity = "common" | "rare";

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  description: string;
}

export const ITEMS: ItemDef[] = [
  { id: "stick", name: "普通树枝", icon: "🪵", rarity: "common", description: "很普通的一根树枝。" },
  { id: "leaf", name: "落叶", icon: "🍂", rarity: "common", description: "一片被山风不小心吹下来的叶子。" },
  { id: "stone", name: "石头", icon: "🪨", rarity: "common", description: "一块圆圆的、凉凉的石头。" },
  { id: "pinecone", name: "松果", icon: "🌰", rarity: "common", description: "不知道哪棵松树掉的。" },
  { id: "mushroom", name: "普通蘑菇", icon: "🍄", rarity: "common", description: "看起来可以吃，但最好别吃。" },
  { id: "flower", name: "野花", icon: "🌸", rarity: "common", description: "一朵不知道名字的小花。" },
  { id: "feather", name: "羽毛", icon: "🪶", rarity: "common", description: "很轻，轻到几乎感觉不到。" },
  { id: "glow_branch", name: "发光树枝", icon: "✨", rarity: "rare", description: "它为什么会发光？" },
  { id: "blue_mushroom", name: "蓝色蘑菇", icon: "🔵", rarity: "rare", description: "森林里好像没有人种过它。" },
  { id: "strange_feather", name: "奇怪的羽毛", icon: "🖋️", rarity: "rare", description: "森林里没有这种鸟。" },
  { id: "moon_stone", name: "月光石", icon: "🌙", rarity: "rare", description: "月亮出来的时候，它会亮一下。" },
  { id: "strange_seed", name: "奇怪的种子", icon: "🌱", rarity: "rare", description: "不知道会长出什么。" },
  { id: "carp", name: "鲤鱼", icon: "🐟", rarity: "common", description: "扑通一声，又跳回水里去了。" },
  { id: "bass", name: "鲈鱼", icon: "🐠", rarity: "common", description: "最合适红烧的那一种。" },
  { id: "puffer", name: "气鼓鼓", icon: "🐡", rarity: "common", description: "你一碰它，它就鼓起来了。" },
  { id: "goldfish", name: "小金鱼", icon: "🧡", rarity: "rare", description: "金色的，闪亮亮的。" },
  { id: "glowfish", name: "发光鱼", icon: "✨", rarity: "rare", description: "夜里看它，自己也亮了起来。" },
];

export const ITEM_MAP: Record<string, ItemDef> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i]),
);

export function getItem(id: string): ItemDef {
  return ITEM_MAP[id] ?? { id, name: id, icon: "❓", rarity: "common", description: "？" };
}
