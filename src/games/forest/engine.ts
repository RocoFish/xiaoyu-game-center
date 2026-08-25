// 《森林里好像有什么》纯逻辑引擎：地图 / 移动 / 拾取 / 河边 / 小屋坐标。

export const TILE = 36;
export const MAP_W = 36;
export const MAP_H = 24;
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

// 河（竖直贯穿）所在列；小屋中心（tile 单位，x/z）。
const RIVER_COL = Math.floor(MAP_W * 0.78);
export const RIVER_X = RIVER_COL + 0.5;
const HUT_ROWS = 2;
const HUT_COLS = [3, 4];
export const HUT_CENTER = { x: 4, z: 2.5 };

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function buildMap(): number[][] {
  const rnd = seededRandom(0x9e3779b9);
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
  for (const col of HUT_COLS) map[HUT_ROWS][col] = TYPES.HUT;
  // 河：竖直贯穿（右侧）
  for (let y = 3; y < MAP_H - 3; y++) map[y][RIVER_COL] = TYPES.WATER;
  // 小路：大门向下 + 一条横向路通往河岸（不覆盖河）
  const pathRow = MAP_H - 6;
  for (let y = 4; y < pathRow; y++) map[y][3] = TYPES.PATH;
  for (let x = 3; x < RIVER_COL; x++) map[pathRow][x] = TYPES.PATH;

  // 内部散布的树（确定性），避开小屋/河岸/小路/中央空地
  const midX = MAP_W / 2;
  const midY = MAP_H / 2;
  for (let ty = 2; ty < MAP_H - 2; ty++) {
    for (let tx = 2; tx < MAP_W - 2; tx++) {
      if (map[ty][tx] !== TYPES.GRASS) continue;
      if (HUT_COLS.includes(tx) && ty <= 4) continue; // 小屋门前清空
      if (tx <= 6 && ty <= 4) continue; // 小屋周围空出
      if (Math.abs(tx - RIVER_COL) <= 1) continue; // 河两岸空出
      if (tx === 3 && ty >= 4) continue; // 竖路
      if (ty === pathRow && tx >= 3 && tx <= RIVER_COL) continue; // 横路
      if (Math.hypot(tx - midX, ty - midY) < 4) continue; // 中央空地
      if (rnd() < 0.09) map[ty][tx] = TYPES.TREE;
    }
  }
  // 花：散落在草地上
  for (let ty = 2; ty < MAP_H - 2; ty++) {
    for (let tx = 2; tx < MAP_W - 2; tx++) {
      if (map[ty][tx] !== TYPES.GRASS) continue;
      if (rnd() < 0.03) map[ty][tx] = TYPES.FLOWER;
    }
  }
  return map;
}

function isBlockedTile(t: number): boolean {
  return BLOCKED.has(t);
}

function findWalkableNear(map: number[][], tx: number, ty: number, radius = 3): [number, number] | null {
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        const t = map[ny]?.[nx];
        if (t !== undefined && !BLOCKED.has(t)) return [nx, ny];
      }
    }
  }
  return null;
}

export function createWorld(): World {
  const map = buildMap();
  const items: WorldItem[] = [];

  const placeAt = (itemId: string, tx: number, ty: number) => {
    const pos = findWalkableNear(map, tx, ty, 4);
    if (pos) items.push({ x: pos[0] * TILE + TILE / 2, y: pos[1] * TILE + TILE / 2, itemId });
  };

  // 固定稀有物品（用相对位置，靠近河/深处）
  placeAt("blue_mushroom", Math.floor(MAP_H * 0.7), RIVER_COL - 2);
  placeAt("glow_branch", Math.floor(MAP_H * 0.25), RIVER_COL + 2);
  placeAt("moon_stone", Math.floor(MAP_H * 0.5), Math.floor(MAP_W * 0.42));
  placeAt("strange_feather", Math.floor(MAP_H * 0.22), Math.floor(MAP_W * 0.16));
  placeAt("strange_seed", Math.floor(MAP_H * 0.6), Math.floor(MAP_W * 0.68));

  // 随机普通物品（散落草地/路/花）
  const common = ["stick", "leaf", "stone", "pinecone", "mushroom", "flower", "feather"];
  const placed = new Set<string>();
  let tries = 0;
  while (items.length < 52 && tries < 1200) {
    tries++;
    const tx = 1 + Math.floor(Math.random() * (MAP_W - 2));
    const ty = 1 + Math.floor(Math.random() * (MAP_H - 2));
    const tile = map[ty]?.[tx];
    if (tile !== TYPES.GRASS && tile !== TYPES.PATH && tile !== TYPES.FLOWER) continue;
    if (placed.has(`${tx},${ty}`)) continue;
    if (Math.abs(tx - 3) < 1 && Math.abs(ty - 4) < 1) continue; // 别挡在门口
    if (HUT_COLS.includes(tx) && ty <= 3) continue; // 别在小屋上
    placed.add(`${tx},${ty}`);
    items.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, itemId: common[Math.floor(Math.random() * common.length)] });
  }

  // 玩家初始在门口（小屋下面的路）
  const player: Player = { x: 3 * TILE + TILE / 2, y: 4 * TILE };

  return { map, items, player, hut: { tx: 3, ty: HUT_ROWS } };
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

/** 玩家是否站在河边（可钓鱼）。 */
export function isNearRiver(world: World): boolean {
  return Math.abs(world.player.x / TILE - RIVER_X) < 2;
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

/** 在可走瓦片上生成一个物品。成功返回 true。 */
export function addItemAt(world: World, itemId: string, tx: number, ty: number): boolean {
  if (!isWalkableTile(tileAt(world, tx, ty))) return false;
  world.items.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, itemId });
  return true;
}

/** 在 (tx,ty) 附近半径内找一个可走瓦片生成物品（供"森林记忆"在大地图上安全投放）。 */
export function spawnItemNear(world: World, itemId: string, tx: number, ty: number, radius = 3): boolean {
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isWalkableTile(tileAt(world, tx + dx, ty + dy))) {
          world.items.push({ x: (tx + dx) * TILE + TILE / 2, y: (ty + dy) * TILE + TILE / 2, itemId });
          return true;
        }
      }
    }
  }
  return false;
}

/** 物品归属的"类别"，用于森林记忆。 */
export const CATEGORY: Record<string, string> = {
  stick: "wood",
  leaf: "wood",
  pinecone: "wood",
  glow_branch: "wood",
  mushroom: "mushroom",
  blue_mushroom: "mushroom",
  stone: "stone",
  moon_stone: "stone",
  flower: "flower",
  strange_feather: "feather",
  strange_seed: "seed",
};
