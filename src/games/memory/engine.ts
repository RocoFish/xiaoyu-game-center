// 记忆翻牌纯逻辑引擎。
export const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 8]; // 8 对
export const TOTAL_CARDS = CARD_VALUES.length * 2;

export interface MemoryState {
  cards: number[];
  flipped: number[]; // 当前翻开的位置（0~2）
  matched: boolean[]; // 每张是否已配对
  moves: number;
  done: boolean;
}

export function createGame(): MemoryState {
  const cards = [...CARD_VALUES, ...CARD_VALUES];
  shuffle(cards);
  return {
    cards,
    flipped: [],
    matched: Array(TOTAL_CARDS).fill(false),
    moves: 0,
    done: false,
  };
}

export function flip(state: MemoryState, index: number): MemoryState {
  if (state.done) return state;
  if (state.matched[index]) return state;
  if (state.flipped.includes(index)) return state;
  if (state.flipped.length >= 2) return state;

  const flipped = [...state.flipped, index];
  if (flipped.length < 2) return { ...state, flipped };

  const moves = state.moves + 1;
  const [a, b] = flipped;
  if (state.cards[a] === state.cards[b]) {
    const matched = [...state.matched];
    matched[a] = true;
    matched[b] = true;
    return { ...state, flipped: [], matched, moves, done: matched.every(Boolean) };
  }
  // 不能匹配：保持两张翻开，由组件稍后调用 clearFlipped
  return { ...state, flipped, moves };
}

export function clearFlipped(state: MemoryState): MemoryState {
  return { ...state, flipped: [] };
}

export function score(state: MemoryState): number {
  const pairs = state.matched.filter(Boolean).length / 2;
  return Math.max(0, pairs * 40 - state.moves * 3);
}

function shuffle(arr: number[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
