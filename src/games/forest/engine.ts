// 《森林里好像有什么》Phase 1 纯逻辑引擎：地图 / 移动 / 拾取。

export const TILE = 36;
export const MAP_W = 26;
export const MAP_H = 18;
export const PLAYER_RADIUS = 12;
export const PLAYER_SPEED = 150; // px/s

export const TYPES = { GRASS: 0, TREE: 1, WATER: 2, PATH: 3, FLOWER: 4, HUT: 5 } as const;
const BLOCKED = new Set<number>([TYPES.TREE, TYPES.WATER, TYPES.HUT]);

export interface WorldItem {
  x: number; // 像素（tile 中心）
  y: number;
  itemId: string;
}

export interface Player {
  x: number;
  y: number;
}

export interface World {
  map: number[][];
  items: WorldItem[];
  player: Player;
  hut: { tx: number; ty: number };
}

function buildMap(): number[][] {
  const map: number[][] = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TYPES.GRASS));
  // 边框树
  for (let x = 0; x < MAP_W; x++) {
    map[0][x] = TYPES.TREE;
    map[MAP_H - 1][x] = TYPES.TREE;
  }
  for (let y = 0; y < MAP_H; y++) {
    map[y][0] = TYPES.TREE;
    map[y][MAP_W - 1] = TYPES.TREE;
  }
  // 小屋（左上）
  map[2][2] = TYPES.HUT;
  map[2][3] = TYPES.HUT;
  // 河（右侧竖直）
  for (let y = 2; y < MAP_H - 2; y++) map[y][19] = TYPES.WATER;
  // 小路（小屋向下 + 向右）
  for (let y = 2; y < MAP_H - 1; y++) map[y][3] = TYPES.PATH;
  for (let x = 3; x < 19; x++) map[9][x] = TYPES.PATH;
  // 内部散布的树（固定几处，形成"林")
  const treeSpots: [number, number][] = [
    [2, 8], [2, 9], [3, 13], [4, 7], [4, 11], [5, 16], [6, 5], [6, 9], [7, 14],
    [8, 17], [10, 6], [11, 12], [12, 4], [12, 15], [13, 10], [14, 17], [15, 7], [16, 13],
  ];
  for (const [ty, tx] of treeSpots) map[ty][tx] = TYPES.TREE;
  // 花
  const flowerSpots: [number, number][] = [
    [4, 5], [7, 8], [11, 3], [13, 14], [15, 16], [6, 12], [9, 2],
  ];
  for (const [ty, tx] of flowerSpots) map[ty][tx] = TYPES.FLOWER;
  return map;
}

function isBlockedTile(t: number): boolean {
  return BLOCKED.has(t);
}

export function createWorld(): World {
  const map = buildMap();
  const items: WorldItem[] = [];

  // 固定稀有物品
  const rareSpots: [number, number, string][] = [
    [14, 8, "blue_mushroom"],
    [5, 13, "glow_branch"],
    [16, 11, "moon_stone"],
    [3, 17, "strange_feather"],
    [12, 8, "strange_seed"],
  ];
  for (const [ty, tx, itemId] of rareSpots) {
    if (map[ty]?.[tx] === TYPES.GRASS) {
      items.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, itemId });
    }
  }

  // 随机普通物品（散落在草地/路上）
  const common = ["stick", "leaf", "stone", "pinecone", "mushroom", "flower", "feather"];
  const placed = new Set<string>();
  let tries = 0;
  while (items.filter((i) => i.itemId === "common-placeholder" || true).length < 40 && tries < 600) {
    tries++;
    const tx = 1 + Math.floor(Math.random() * (MAP_W - 2));
    const ty = 1 + Math.floor(Math.random() * (MAP_H - 2));
    const tile = map[ty]?.[tx];
    if (tile !== TYPES.GRASS && tile !== TYPES.PATH && tile !== TYPES.FLOWER) continue;
    if (placed.has(`${tx},${ty}`)) continue;
    // 别挡在门口/小屋
    if (Math.abs(tx - 3) < 1 && Math.abs(ty - 2) < 1) continue;
    placed.add(`${tx},${ty}`);
    const itemId = common[Math.floor(Math.random() * common.length)];
    items.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, itemId });
    if (items.length >= 40) break;
  }

  // 玩家初始在门口（小屋下面的路）
  const player: Player = { x: 3 * TILE + TILE / 2, y: 4 * TILE };

  return { map, items, player, hut: { tx: 2, ty: 2 } };
}

export function isWalkableTile(t: number): boolean {
  return !BLOCKED.has(t);
}

export function tileAt(world: World, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return TYPES.TREE;
  return world.map[ty][tx];
}

function blockedAt(world: World, px: number, py: number): boolean {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return !isWalkableTile(tileAt(world, tx, ty));
}

function collides(world: World, px: number, py: number): boolean {
  const r = PLAYER_RADIUS;
  return (
    blockedAt(world, px - r, py) ||
    blockedAt(world, px + r, py) ||
    blockedAt(world, px, py - r) ||
    blockedAt(world, px, py + r) ||
    blockedAt(world, px, py)
  );
}

export function movePlayer(world: World, dx: number, dy: number, dt: number): void {
  const nx = world.player.x + dx * PLAYER_SPEED * dt;
  const ny = world.player.y + dy * PLAYER_SPEED * dt;
  if (!collides(world, nx, world.player.y)) world.player.x = nx;
  if (!collides(world, world.player.x, ny)) world.player.y = ny;
  // 限制在地图内
  world.player.x = Math.max(TILE, Math.min(MAP_W * TILE - TILE, world.player.x));
  world.player.y = Math.max(TILE, Math.min(MAP_H * TILE - TILE, world.player.y));
}

/** 拾取玩家附近（约 1.6 格内）的物品。返回物品或 null。 */
export function pickupNearby(world: World): WorldItem | null {
  const reach = TILE * 1.6;
  let best: WorldItem | null = null;
  let bestDist = reach;
  for (let i = world.items.length - 1; i >= 0; i--) {
    const it = world.items[i];
    const d = Math.hypot(it.x - world.player.x, it.y - world.player.y);
    if (d <= bestDist) {
      bestDist = d;
      best = it;
    }
  }
  return best;
}

export function removeItem(world: World, item: WorldItem): void {
  const idx = world.items.indexOf(item);
  if (idx >= 0) world.items.splice(idx, 1);
}
