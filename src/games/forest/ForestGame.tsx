"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getItem, type ItemDef } from "./items";
import {
  MAP_H,
  MAP_W,
  PLAYER_RADIUS,
  TILE,
  TYPES,
  createWorld,
  movePlayer,
  removeItem,
  type World,
  type WorldItem,
} from "./engine";

const INV_KEY = "forest_inventory";

function loadInv(): Record<string, number> {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(INV_KEY) : null;
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function ForestGame() {
  const { user } = useAuth();
  const worldRef = useRef<World>(null as unknown as World);
  if (!worldRef.current) worldRef.current = createWorld();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const keyVecRef = useRef({ x: 0, y: 0 });
  const joyVecRef = useRef({ x: 0, y: 0 });
  const [inventory, setInventory] = useState<Record<string, number>>(loadInv);
  const [showInv, setShowInv] = useState(false);
  const [selected, setSelected] = useState<ItemDef | null>(null);
  const [hint, setHint] = useState<{ text: string; kind: "ok" | "warn" } | null>(null);

  const saveInv = useCallback((next: Record<string, number>) => {
    setInventory(next);
    try {
      localStorage.setItem(INV_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const showHint = useCallback((text: string, kind: "ok" | "warn") => {
    setHint({ text, kind });
    window.setTimeout(() => setHint(null), 2200);
  }, []);

  // 键盘
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) keyVecRef.current.y = -1;
      else if (["arrowdown", "s"].includes(k)) keyVecRef.current.y = 1;
      else if (["arrowleft", "a"].includes(k)) keyVecRef.current.x = -1;
      else if (["arrowright", "d"].includes(k)) keyVecRef.current.x = 1;
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) keyVecRef.current.y = 0;
      else if (["arrowdown", "s"].includes(k)) keyVecRef.current.y = 0;
      else if (["arrowleft", "a"].includes(k)) keyVecRef.current.x = 0;
      else if (["arrowright", "d"].includes(k)) keyVecRef.current.x = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // 主循环 + 绘制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = MAP_W * TILE;
    const H = MAP_H * TILE;

    const drawItem = (it: WorldItem) => {
      const def = getItem(it.itemId);
      ctx.font = `${Math.floor(TILE * 0.7)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.icon, it.x, it.y);
      if (def.rarity === "rare") {
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(it.x, it.y, TILE * 0.42, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const w = worldRef.current;
      // 草地底色
      ctx.fillStyle = "#3f7d3a";
      ctx.fillRect(0, 0, W, H);
      // 瓦片
      for (let ty = 0; ty < MAP_H; ty++) {
        for (let tx = 0; tx < MAP_W; tx++) {
          const t = w.map[ty][tx];
          const x = tx * TILE;
          const y = ty * TILE;
          if (t === TYPES.TREE) {
            ctx.fillStyle = "#2f5f2f";
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = "#1f4a20";
            ctx.beginPath();
            ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.42, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#7c4a1f";
            ctx.fillRect(x + TILE / 2 - 3, y + TILE / 2 + 6, 6, TILE * 0.35);
          } else if (t === TYPES.WATER) {
            ctx.fillStyle = "#3b7fb0";
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = "rgba(255,255,255,0.25)";
            ctx.fillRect(x + 4, y + TILE / 2 - 2, TILE - 8, 4);
          } else if (t === TYPES.PATH) {
            ctx.fillStyle = "#b9986a";
            ctx.fillRect(x, y, TILE, TILE);
          } else if (t === TYPES.FLOWER) {
            ctx.fillStyle = "#4e9248";
            ctx.fillRect(x, y, TILE, TILE);
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🌼", x + TILE / 2, y + TILE / 2);
          } else if (t === TYPES.HUT) {
            ctx.fillStyle = "#8a5a2b";
            ctx.fillRect(x + 2, y + 8, TILE - 4, TILE - 10);
            ctx.fillStyle = "#a06a38";
            ctx.beginPath();
            ctx.moveTo(x, y + 10);
            ctx.lineTo(x + TILE / 2, y - 6);
            ctx.lineTo(x + TILE, y + 10);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
      // 物品
      for (const it of w.items) drawItem(it);
      // 玩家
      ctx.fillStyle = "#f4a261";
      ctx.beginPath();
      ctx.arc(w.player.x, w.player.y, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const loop = (now: number) => {
      const dt = lastTsRef.current ? Math.min((now - lastTsRef.current) / 1000, 0.05) : 0;
      lastTsRef.current = now;
      const vx = keyVecRef.current.x + joyVecRef.current.x;
      const vy = keyVecRef.current.y + joyVecRef.current.y;
      if (vx !== 0 || vy !== 0) movePlayer(worldRef.current, vx, vy, dt);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // 点击画布 → 拾取
  const onCanvasTap = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * MAP_W * TILE;
      const py = ((e.clientY - rect.top) / rect.height) * MAP_H * TILE;
      const world = worldRef.current;
      // 找点击位置附近的物品
      let target: WorldItem | null = null;
      let best = TILE * 0.55;
      for (const it of world.items) {
        const d = Math.hypot(it.x - px, it.y - py);
        if (d <= best) {
          best = d;
          target = it;
        }
      }
      if (!target) return;
      const pdist = Math.hypot(target.x - world.player.x, target.y - world.player.y);
      if (pdist > TILE * 1.7) {
        showHint("走近一点才能捡起", "warn");
        return;
      }
      const def = getItem(target.itemId);
      removeItem(world, target);
      const next = { ...inventory, [target.itemId]: (inventory[target.itemId] ?? 0) + 1 };
      saveInv(next);
      showHint(`${def.icon} 捡起「${def.name}」${def.rarity === "rare" ? "（稀有！）" : ""}`, "ok");
    },
    [inventory, saveInv, showHint],
  );

  const inventoryEntries = Object.entries(inventory).sort((a, b) => {
    const ra = getItem(a[0]).rarity === "rare" ? 1 : 0;
    const rb = getItem(b[0]).rarity === "rare" ? 1 : 0;
    return ra - rb || (getItem(a[0]).name < getItem(b[0]).name ? -1 : 1);
  });

  return (
    <div className="mx-auto w-full max-w-[760px]">
      {/* 顶部栏 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {user ? "已登录 · 森林将被保存" : "游客模式 · 登录后保存森林"}
        </div>
        <button
          onClick={() => setShowInv(true)}
          className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-zinc-100 transition hover:bg-white/20"
        >
          🎒 背包
        </button>
      </div>

      {/* 森林画布 */}
      <div className="relative aspect-[26/18] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#22401f] shadow-xl">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none select-none"
          onPointerDown={onCanvasTap}
        />

        {/* 提示 */}
        {hint && (
          <div
            className={cn(
              "pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full px-4 py-1.5 text-sm font-semibold backdrop-blur",
              hint.kind === "ok" ? "bg-green-500/20 text-green-200" : "bg-amber-500/20 text-amber-200",
            )}
          >
            {hint.text}
          </div>
        )}

        {/* 虚拟摇杆（左下） */}
        <Joystick onMove={(x, y) => (joyVecRef.current = { x, y })} />
      </div>

      <p className="mt-3 text-center text-xs text-zinc-500">
        WASD / 方向键移动 · 手机拖左下摇杆 · 点击物品捡起，靠近才能捡
      </p>

      {/* 背包弹窗 */}
      {showInv && (
        <Modal onClose={() => setShowInv(false)} title="🎒 背包">
          {inventoryEntries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">背包空空如也，去森林里捡点东西吧。</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {inventoryEntries.map(([id, count]) => {
                const def = getItem(id);
                return (
                  <button
                    key={id}
                    onClick={() => setSelected(def)}
                    className={cn(
                      "rounded-xl border p-2 text-center transition hover:border-white/30",
                      def.rarity === "rare" ? "border-orange-500/40 bg-orange-500/10" : "border-white/10 bg-white/5",
                    )}
                  >
                    <div className="text-2xl">{def.icon}</div>
                    <div className="mt-1 truncate text-xs font-semibold">{def.name}</div>
                    <div className="text-xs text-muted-foreground">× {count}</div>
                  </button>
                );
              })}
            </div>
          )}
          {selected && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold">{selected.icon} {selected.name}</span>
                <span className={selected.rarity === "rare" ? "text-orange-400" : "text-muted-foreground"}>
                  {selected.rarity === "rare" ? "稀有" : "普通"}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">{selected.description}</p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const active = useRef(false);

  const setKnob = useCallback((dx: number, dy: number) => {
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }, []);

  const handle = useCallback(
    (e: React.PointerEvent) => {
      const base = ref.current;
      if (!base) return;
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const max = rect.width / 2 - 22;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > max) {
        dx = (dx / dist) * max;
        dy = (dy / dist) * max;
      }
      setKnob(dx, dy);
      onMove(dx / max, dy / max);
    },
    [onMove, setKnob],
  );

  return (
    <div
      ref={ref}
      className="absolute bottom-4 left-4 h-32 w-32 touch-none rounded-full bg-black/25 backdrop-blur"
      onPointerDown={(e) => {
        active.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        handle(e);
      }}
      onPointerMove={(e) => {
        if (active.current) handle(e);
      }}
      onPointerUp={() => {
        active.current = false;
        setKnob(0, 0);
        onMove(0, 0);
      }}
    >
      <div
        ref={knobRef}
        className="absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-white/70 shadow"
      />
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="关闭" className="rounded-lg p-1 text-muted-foreground hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
