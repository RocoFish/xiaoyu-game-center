"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { ITEMS, getItem, type ItemDef } from "./items";
import { FURNITURE, getFurniture } from "./house";
import { ForestScene3D, type MysteryMarker } from "./Scene3D";
import {
  TILE,
  CATEGORY,
  addItemAt,
  createWorld,
  movePlayer,
  pickupNearby,
  removeItem,
  tileAt,
  isWalkableTile,
  type World,
  type WorldItem,
} from "./engine";

const INV_KEY = "forest_inventory";
const DISC_KEY = "forest_discovered";
const STATS_KEY = "forest_stats";
const DAY_CYCLE = 240; // 一整天 = 4 分钟（游戏内部时间）

const MYSTERY_EVENTS = [
  { icon: "🐾", text: "一串脚印延伸进树林深处……" },
  { icon: "🪵", text: "这根树枝，好像刚刚才被折断。" },
  { icon: "🪨", text: "你确定，昨天这里还没有这个石堆。" },
  { icon: "🍄", text: "一个发着微弱蓝光的蘑菇，安静地长着。" },
  { icon: "👀", text: "你似乎看见远处有一双小眼睛，可一靠近就没了。" },
];

interface StatState {
  wood?: number;
  mushroom?: number;
  stone?: number;
  flower?: number;
  night?: number;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function timeLabel(p: number): string {
  if (p < 0.25) return "清晨";
  if (p < 0.55) return "白天";
  if (p < 0.78) return "黄昏";
  return "夜晚";
}

export function ForestGame() {
  const { user } = useAuth();

  const worldRef = useRef<World>(null as unknown as World);
  if (!worldRef.current) worldRef.current = createWorld();
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const keyVecRef = useRef({ x: 0, y: 0 });
  const joyVecRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const weatherRef = useRef<"sunny" | "rain">("sunny");
  const weatherTimerRef = useRef(45 + Math.random() * 30);
  const statsRef = useRef<StatState>(loadJson(STATS_KEY, {}));
  const reactedRef = useRef<Set<string>>(new Set());
  const mysteryRef = useRef<MysteryMarker[]>([]);
  const eventTimerRef = useRef(28 + Math.random() * 20);
  const saveTimerRef = useRef<number | null>(null);
  const userRef = useRef(user);

  const [inventory, setInventory] = useState<Record<string, number>>(() => loadJson(INV_KEY, {}));
  const [discovered, setDiscovered] = useState<string[]>(() => loadJson(DISC_KEY, []));
  const [showInv, setShowInv] = useState(false);
  const [journal, setJournal] = useState<boolean>(false);
  const [selected, setSelected] = useState<ItemDef | null>(null);
  const [hint, setHint] = useState<{ text: string; kind: "ok" | "warn" } | null>(null);
  const [house, setHouse] = useState<(string | null)[]>(() => loadJson("forest_house", Array(9).fill(null)));
  const [showHouse, setShowHouse] = useState(false);
  const [globalStats, setGlobalStats] = useState<{ pickup: number; mushroom: number; visit: number }>({
    pickup: 0,
    mushroom: 0,
    visit: 0,
  });

  // 3D 世界"实体版本号"：物品 / 神秘标记变化时递增，驱动 3D 层重渲染。
  const [worldVersion, setWorldVersion] = useState(0);
  const playerDirRef = useRef({ x: 0, z: 1 });

  // 全屏
  const gameRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 天气/昼夜显示（节流更新 UI）
  const [weatherUI, setWeatherUI] = useState<"sunny" | "rain">("sunny");
  const [timeUI, setTimeUI] = useState("白天");

  const hintTimerRef = useRef<number | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHint(null), 2400);
  }, []);

  const discover = useCallback((itemId: string) => {
    setDiscovered((prev) => {
      if (prev.includes(itemId)) return prev;
      const next = [...prev, itemId];
      try {
        localStorage.setItem(DISC_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const saveStats = useCallback(() => {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(statsRef.current));
    } catch {
      // ignore
    }
  }, []);

  // 森林记忆：根据玩家行为，森林做出回应（一次性）
  const checkResponses = useCallback(() => {
    const w = worldRef.current;
    const s = statsRef.current;
    if (!reactedRef.current.has("wood") && (s.wood ?? 0) >= 6) {
      reactedRef.current.add("wood");
      if (addItemAt(w, "flower", 4, 2)) showHint("森林好像在你常捡树枝的地方，开了一朵花。", "ok");
    }
    if (!reactedRef.current.has("mushroom") && (s.mushroom ?? 0) >= 3) {
      reactedRef.current.add("mushroom");
      if (addItemAt(w, "blue_mushroom", 2, 4)) showHint("你捡了很多蘑菇……森林里冒出一株蓝色的。", "ok");
    }
    if (!reactedRef.current.has("stone") && (s.stone ?? 0) >= 4) {
      reactedRef.current.add("stone");
      if (addItemAt(w, "moon_stone", 18, 9)) showHint("河边的石头少了一块，那里多了一颗会发亮的石头。", "ok");
    }
    // 秘密：夜里多次来访 → 树下出现神秘种子
    if (!reactedRef.current.has("night") && (s.night ?? 0) >= 3) {
      reactedRef.current.add("night");
      if (addItemAt(w, "strange_seed", 6, 2)) showHint("夜深了。你常去的树下，多了一粒奇怪的种子。", "ok");
    }
  }, [showHint]);

  // 神秘事件：偶尔在玩家附近出现一个"不对劲"的标记
  const spawnMystery = useCallback(() => {
    const w = worldRef.current;
    const ev = MYSTERY_EVENTS[Math.floor(Math.random() * MYSTERY_EVENTS.length)];
    const px = Math.floor(w.player.x / TILE);
    const py = Math.floor(w.player.y / TILE);
    const spots: [number, number][] = [
      [px, py - 2], [px, py + 2], [px - 2, py], [px + 2, py], [px - 2, py + 2], [px + 2, py - 2],
    ];
    for (const [tx, ty] of spots) {
      if (isWalkableTile(tileAt(w, tx, ty))) {
        mysteryRef.current.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, icon: ev.icon, text: ev.text });
        return;
      }
    }
  }, []);

  // 拾取物品：移除 + 背包 + 图鉴 + 统计 + 森林记忆 + 全球统计 + 提示，并驱动 3D 重渲染
  const pickUpItem = useCallback(
    (item: WorldItem) => {
      const w = worldRef.current;
      removeItem(w, item);
      const def = getItem(item.itemId);
      setInventory((prev) => {
        const next = { ...prev, [item.itemId]: (prev[item.itemId] ?? 0) + 1 };
        try {
          localStorage.setItem(INV_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      discover(item.itemId);
      const cat = CATEGORY[item.itemId];
      if (cat) statsRef.current[cat as keyof StatState] = (statsRef.current[cat as keyof StatState] ?? 0) + 1;
      const night = (timeRef.current % DAY_CYCLE) / DAY_CYCLE >= 0.78;
      if (night) statsRef.current.night = (statsRef.current.night ?? 0) + 1;
      saveStats();
      checkResponses();
      if (userRef.current) {
        void fetch("/api/forest/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: cat === "mushroom" ? "mushroom" : "pickup" }),
        }).catch(() => {});
      }
      showHint(
        `${def.icon} 拾起「${def.name}」${def.rarity === "rare" ? "（稀有！）" : ""}` +
          (night && def.rarity === "rare" ? " · 月光下它似乎更亮了" : ""),
        "ok",
      );
      setWorldVersion((v) => v + 1);
    },
    [discover, saveStats, checkResponses, showHint],
  );

  // 登录用户：加载 / 保存森林（Supabase forest_state）
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    getSupabaseBrowser()
      .from("forest_state")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted || !data?.data) return;
        const d = data.data as { inventory?: Record<string, number>; discovered?: string[]; stats?: StatState; house?: (string | null)[] };
        if (d.house) setHouse(d.house);
        if (d.inventory) {
          setInventory(d.inventory);
          try { localStorage.setItem(INV_KEY, JSON.stringify(d.inventory)); } catch {}
        }
        if (d.discovered) {
          setDiscovered(d.discovered);
          try { localStorage.setItem(DISC_KEY, JSON.stringify(d.discovered)); } catch {}
        }
        if (d.stats) {
          statsRef.current = d.stats;
          saveStats();
        }
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  // 变化时节流保存
  useEffect(() => {
    if (!user) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      getSupabaseBrowser()
        .from("forest_state")
        .upsert({ user_id: user.id, data: { inventory, discovered, stats: statsRef.current, house } }, { onConflict: "user_id" })
        .then(() => {});
    }, 1200);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [user, inventory, discovered, house, saveTimerRef]);

  // 全球今日统计 + 进入森林记一次 visit
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    getSupabaseBrowser()
      .from("forest_daily_stats")
      .select("action, total")
      .eq("day", today)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        for (const r of (data ?? []) as { action: string; total: number }[]) map[r.action] = r.total ?? 0;
        setGlobalStats({ pickup: map.pickup ?? 0, mushroom: map.mushroom ?? 0, visit: map.visit ?? 0 });
      });
    if (user) {
      void fetch("/api/forest/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "visit" }) }).catch(() => {});
    }
  }, [user]);

  // 摆放 / 移除家具
  const placeFurniture = useCallback(
    (fid: string) => {
      const def = getFurniture(fid);
      if (!def) return;
      for (const [itemId, n] of Object.entries(def.cost)) {
        if ((inventory[itemId] ?? 0) < (n ?? 0)) {
          showHint("资源不够，去森林里多捡一点吧。", "warn");
          return;
        }
      }
      const nextInv = { ...inventory };
      for (const [itemId, n] of Object.entries(def.cost)) nextInv[itemId] = (nextInv[itemId] ?? 0) - (n ?? 0);
      saveInv(nextInv);
      const nextHouse = [...house];
      const empty = nextHouse.indexOf(null);
      if (empty === -1) {
        showHint("小屋已经摆满了。", "warn");
        return;
      }
      nextHouse[empty] = fid;
      setHouse(nextHouse);
      try { localStorage.setItem("forest_house", JSON.stringify(nextHouse)); } catch {}
      showHint(`在屋里摆了「${def.name}」`, "ok");
    },
    [house, inventory, saveInv, showHint],
  );

  const removeFurniture = useCallback((idx: number) => {
    const nextHouse = [...house];
    nextHouse[idx] = null;
    setHouse(nextHouse);
    try { localStorage.setItem("forest_house", JSON.stringify(nextHouse)); } catch {}
  }, [house]);

  // 全屏
  const toggleFullscreen = useCallback(() => {
    const el = gameRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // 键盘：移动
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) keyVecRef.current.y = -1;
      else if (["arrowdown", "s"].includes(k)) keyVecRef.current.y = 1;
      else if (["arrowleft", "a"].includes(k)) keyVecRef.current.x = -1;
      else if (["arrowright", "d"].includes(k)) keyVecRef.current.x = 1;
      else if (k === "e" || k === "i") setShowInv((v) => !v);
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

  // ESC：优先关闭背包/图鉴/小屋弹窗，其次退出全屏
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showInv) {
        e.preventDefault();
        setShowInv(false);
        return;
      }
      if (journal) {
        e.preventDefault();
        setJournal(false);
        return;
      }
      if (showHouse) {
        e.preventDefault();
        setShowHouse(false);
        return;
      }
      if (document.fullscreenElement) {
        e.preventDefault();
        void document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showInv, journal, showHouse]);

  // 主循环：推进时间 / 天气 / 昼夜 / 神秘事件，移动玩家，自动拾取
  useEffect(() => {
    const loop = (now: number) => {
      const dt = lastTsRef.current ? Math.min((now - lastTsRef.current) / 1000, 0.05) : 0;
      lastTsRef.current = now;

      timeRef.current += dt;
      eventTimerRef.current -= dt;
      if (eventTimerRef.current <= 0) {
        eventTimerRef.current = 35 + Math.random() * 30;
        if (Math.random() < 0.65) spawnMystery();
        setWorldVersion((v) => v + 1);
      }
      weatherTimerRef.current -= dt;
      if (weatherTimerRef.current <= 0) {
        weatherRef.current = weatherRef.current === "sunny" ? "rain" : "sunny";
        weatherTimerRef.current = 40 + Math.random() * 40;
        setWeatherUI(weatherRef.current);
      }
      const p = (timeRef.current % DAY_CYCLE) / DAY_CYCLE;
      const lbl = timeLabel(p);
      setTimeUI((prev) => (prev === lbl ? prev : lbl));

      const vx = keyVecRef.current.x + joyVecRef.current.x;
      const vy = keyVecRef.current.y + joyVecRef.current.y;
      if (vx !== 0 || vy !== 0) movePlayer(worldRef.current, vx, vy, dt);

      // 自动拾取：走近物品直接捡起（无需点击）
      const near = pickupNearby(worldRef.current);
      if (near) pickUpItem(near);

      // 神秘事件：靠近时揭示
      const w = worldRef.current;
      for (let i = mysteryRef.current.length - 1; i >= 0; i--) {
        const m = mysteryRef.current[i];
        if (Math.hypot(m.x - w.player.x, m.y - w.player.y) < TILE * 1.2) {
          mysteryRef.current.splice(i, 1);
          showHint(`${m.icon} ${m.text}`, "warn");
          setWorldVersion((v) => v + 1);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spawnMystery, pickUpItem, showHint]);

  const inventoryEntries = Object.entries(inventory).sort((a, b) => {
    const ra = getItem(a[0]).rarity === "rare" ? 1 : 0;
    const rb = getItem(b[0]).rarity === "rare" ? 1 : 0;
    return ra - rb || (getItem(a[0]).name < getItem(b[0]).name ? -1 : 1);
  });
  const discoveredSet = new Set(discovered);

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <div
        ref={gameRef}
        className={cn("flex flex-col gap-3", isFullscreen && "h-full min-h-0")}
      >
        {/* 顶部栏 */}
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>🕐 {timeUI}</span>
            <span>{weatherUI === "rain" ? "🌧️ 下雨" : "☀️ 晴朗"}</span>
            <span className="hidden sm:inline">{user ? "已登录" : "游客"}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setJournal(true)}
              className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-zinc-100 transition hover:bg-white/20"
            >
              📖 图鉴
            </button>
            <button
              onClick={() => setShowInv(true)}
              className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-zinc-100 transition hover:bg-white/20"
            >
              🎒 背包
            </button>
            <button
              onClick={() => setShowHouse(true)}
              className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-zinc-100 transition hover:bg-white/20"
            >
              🏠 小屋
            </button>
          </div>
        </div>

        {/* 全球今日统计 */}
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-zinc-300">
          🌍 今日全部玩家：捡起 {globalStats.pickup} · 蘑菇 {globalStats.mushroom} · 探索 {globalStats.visit}
        </div>

        {/* 3D 森林 */}
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#22401f] shadow-xl",
            isFullscreen ? "min-h-0 flex-1" : "aspect-[26/18]",
          )}
        >
          <div className="absolute inset-0">
            <ForestScene3D
              world={worldRef.current}
              timeRef={timeRef}
              weatherRef={weatherRef}
              mysteryRef={mysteryRef}
              worldVersion={worldVersion}
              playerDirRef={playerDirRef}
            />
          </div>

          {/* 全屏按钮 */}
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "退出全屏" : "全屏"}
            className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black/30 text-zinc-200 transition hover:bg-black/50"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

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

          <Joystick onMove={(x, y) => (joyVecRef.current = { x, y })} />
        </div>

        <p className="text-center text-xs text-zinc-500">
          WASD / 方向键移动 · 手机拖左下摇杆 · 走近物品自动拾取 · E/I 开背包 · ESC 关弹窗/退出全屏
        </p>

      {/* 背包 */}
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

      {/* 森林图鉴 */}
      {journal && (
        <Modal onClose={() => setJournal(false)} title="📖 森林图鉴">
          <div className="mb-3 text-sm text-muted-foreground">
            已发现 {discoveredSet.size} / {ITEMS.length} 种事物
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ITEMS.map((def) => {
              const found = discoveredSet.has(def.id);
              return (
                <div
                  key={def.id}
                  className={cn(
                    "rounded-xl border p-2 text-center",
                    found ? "border-white/15 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-60",
                  )}
                >
                  <div className="text-2xl">{found ? def.icon : "❓"}</div>
                  <div className="mt-1 truncate text-xs font-semibold">
                    {found ? def.name : "？？？"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {found ? (def.rarity === "rare" ? "稀有" : "普通") : "未发现"}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {/* 小屋 */}
      {showHouse && (
        <Modal onClose={() => setShowHouse(false)} title="🏠 小屋">
          <div className="grid grid-cols-3 gap-2">
            {house.map((fid, i) => (
              <button
                key={i}
                onClick={() => fid && removeFurniture(i)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-xl border text-3xl",
                  fid ? "border-amber-500/40 bg-amber-500/10" : "border-dashed border-white/10 bg-white/[0.02]",
                )}
              >
                {fid ? getFurniture(fid)?.icon : ""}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">点已摆放的家具可收起</div>
          <div className="mt-3 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {FURNITURE.map((f) => {
                const can = Object.entries(f.cost).every(([id, n]) => (inventory[id] ?? 0) >= (n ?? 0));
                const costStr = Object.entries(f.cost)
                  .map(([id, n]) => `${getItem(id).name}×${n}`)
                  .join(" + ");
                return (
                  <div key={f.id} className="rounded-xl border border-white/10 bg-white/5 p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{f.icon}</span>
                      <span className="text-xs font-semibold">{f.name}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{costStr}</div>
                    {f.weird && <div className="mt-1 text-[10px] text-orange-300/80">{f.weird}</div>}
                    <button
                      onClick={() => placeFurniture(f.id)}
                      disabled={!can}
                      className="mt-1 w-full rounded-lg bg-orange-500 py-1 text-xs font-semibold text-black transition hover:bg-orange-400 disabled:opacity-40"
                    >
                      {can ? "摆放" : "资源不足"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
      </div>
    </div>
  );
}

function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const active = useRef(false);

  const setKnob = useCallback((dx: number, dy: number) => {
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
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
