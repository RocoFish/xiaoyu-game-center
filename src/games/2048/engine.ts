// 2048 纯逻辑引擎：不依赖 DOM，便于测试与复用。

export const GRID_SIZE = 4;

export type Direction = "up" | "down" | "left" | "right";
export type Board = number[][]; // 4×4，0 表示空

export interface GameState {
  board: Board;
  score: number;
  over: boolean;
  won: boolean;
}

export function createGame(): GameState {
  const board = emptyBoard();
  spawnTile(board);
  spawnTile(board);
  return { board, score: 0, over: false, won: false };
}

/** 朝某个方向移动，合并相同的数字。若无效移动则返回原状态。 */
export function move(state: GameState, dir: Direction): GameState {
  const { board: next, gained } = slide(state.board, dir);
  if (equal(state.board, next)) return state;

  spawnTile(next);
  const over = isOver(next);
  const won = state.won || has2048(next);
  return { board: next, score: state.score + gained, over, won };
}

function emptyBoard(): Board {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function spawnTile(b: Board): void {
  const empty: { r: number; c: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!b[r][c]) empty.push({ r, c });
    }
  }
  if (!empty.length) return;
  const { r, c } = empty[Math.floor(Math.random() * empty.length)];
  b[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function slideLine(line: number[]): { line: number[]; gained: number } {
  const tiles = line.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      const merged = tiles[i] * 2;
      out.push(merged);
      gained += merged;
      i++;
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < GRID_SIZE) out.push(0);
  return { line: out, gained };
}

function slide(b: Board, dir: Direction): { board: Board; gained: number } {
  const next = emptyBoard();
  let gained = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    let line: number[];
    if (dir === "left") line = b[i].slice();
    else if (dir === "right") line = b[i].slice().reverse();
    else if (dir === "up") line = b.map((r) => r[i]);
    else line = b.map((r) => r[i]).reverse();

    const res = slideLine(line);

    if (dir === "left") next[i] = res.line;
    else if (dir === "right") next[i] = res.line.slice().reverse();
    else if (dir === "up") {
      for (let j = 0; j < GRID_SIZE; j++) next[j][i] = res.line[j];
    } else {
      for (let j = 0; j < GRID_SIZE; j++) next[GRID_SIZE - 1 - j][i] = res.line[j];
    }

    gained += res.gained;
  }
  return { board: next, gained };
}

function equal(a: Board, b: Board): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

function isOver(b: Board): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!b[r][c]) return false;
      if (r + 1 < GRID_SIZE && b[r][c] === b[r + 1][c]) return false;
      if (c + 1 < GRID_SIZE && b[r][c] === b[r][c + 1]) return false;
    }
  }
  return true;
}

function has2048(b: Board): boolean {
  return b.some((row) => row.some((v) => v >= 2048));
}
