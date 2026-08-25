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
  HUT_CENTER,
  createWorld,
  movePlayer,
  pickupNearby,
  removeItem,
  tileAt,
  isWalkableTile,
  isNearRiver,
  spawnItemNear,
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

// 小屋里的售卖机：用「星星」换东西，形成正反馈循环。
interface VendorProduct {
  id: string;
  name: string;
  icon: string;
  cost: number;
  desc: string;
  kind: "item" | "furniture";
}

const VENDOR_PRODUCTS: VendorProduct[] = [
  { id: "bait", name: "特制鱼饵", icon: "🪱", cost: 30, desc: "钓鱼时提高稀有鱼出现率（每次消耗一粒）", kind: "item" },
  { id: "goldfish", name: "小金鱼", icon: "🧡", cost: 40, desc: "买回去，它会陪着你。", kind: "item" },
  { id: "moon_stone", name: "月光石", icon: "🌙", cost: 45, desc: "月亮出来的时候，它会亮一下。", kind: "item" },
  { id: "glowfish", name: "发光鱼", icon: "✨", cost: 60, desc: "夜里，它自己会亮。", kind: "item" },
  { id: "strange_seed", name: "奇怪的种子", icon: "🌱", cost: 55, desc: "不知道会长出什么。", kind: "item" },
  { id: "lamp", name: "蘑菇灯（家具）", icon: "🪔", cost: 50, desc: "摆进小屋。", kind: "furniture" },
  { id: "clock", name: "不会走的钟（家具）", icon: "🕰️", cost: 55, desc: "摆进小屋。", kind: "furniture" },
  { id: "piano", name: "没人弹的钢琴（家具）", icon: "🎹", cost: 90, desc: "摆进小屋。", kind: "furniture" },
];

// 可出售物品 → 星星价（卖给售卖机）
const SELL_PRICES: Record<string, number> = {
  stick: 1, leaf: 1, pinecone: 2, stone: 2, mushroom: 3, flower: 2, feather: 2,
  carp: 6, bass: 7, puffer: 8, goldfish: 25, glowfish: 35,
  glow_branch: 15, blue_mushroom: 20, strange_feather: 25, moon_stone: 22, strange_seed: 28,
  bait: 5,
};

interface StatState {
  wood?: number;
  mushroom?: number;
  stone?: number;
  flower?: number;
  night?: number;
  fish?: number;
  stars?: number;
  energy?: number;
}

type FishPhase = "idle" | "casting" | "biting";

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

  // 钓鱼
  const [nearRiver, setNearRiver] = useState(false);
  const [fishPhase, setFishPhase] = useState<FishPhase>("idle");
  const [fishZone, setFishZone] = useState<[number, number]>([0.4, 0.62]);
  const [houseTab, setHouseTab] = useState<"furniture" | "vending">("furniture");

  // 小屋 / 能量
  const [inHouse, setInHouse] = useState(false);
  const [nearHut, setNearHut] = useState(false);
  const [vendingTab, setVendingTab] = useState<"buy" | "sell">("buy");
  const [sleeping, setSleeping] = useState(false);
  const [energyUI, setEnergyUI] = useState(100);

  // 天气/昼夜显示（节流更新 UI）
  const [weatherUI, setWeatherUI] = useState<"sunny" | "rain">("sunny");
  const [timeUI, setTimeUI] = useState("白天");

  const hintTimerRef = useRef<number | null>(null);
  const inventoryRef = useRef(inventory);
  const nearRiverRef = useRef(false);
  const fishPhaseRef = useRef<FishPhase>("idle");
  const fishCursorRef = useRef(0.3);
  const fishZoneRef = useRef<[number, number]>([0.4, 0.62]);
  const fishDirRef = useRef(1);
  const fishBaitBoostRef = useRef(false);
  const fishCastTimerRef = useRef<number | null>(null);
  const fishAutoMissRef = useRef<number | null>(null);
  const nearHutRef = useRef(false);
  const sleepTimerRef = useRef<number | null>(null);
  const sleepingRef = useRef(false);
  const lowEnergyWarnedRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);

  useEffect(() => {
    nearRiverRef.current = nearRiver;
  }, [nearRiver]);

  useEffect(() => {
    nearHutRef.current = nearHut;
  }, [nearHut]);

  useEffect(() => {
    sleepingRef.current = sleeping;
  }, [sleeping]);

  useEffect(() => {
    fishPhaseRef.current = fishPhase;
  }, [fishPhase]);

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
      if (spawnItemNear(w, "flower", 5, 3, 2)) showHint("森林好像在你常捡树枝的地方，开了一朵花。", "ok");
    }
    if (!reactedRef.current.has("mushroom") && (s.mushroom ?? 0) >= 3) {
      reactedRef.current.add("mushroom");
      if (spawnItemNear(w, "blue_mushroom", 2, 5, 2)) showHint("你捡了很多蘑菇……森林里冒出一株蓝色的。", "ok");
    }
    if (!reactedRef.current.has("stone") && (s.stone ?? 0) >= 4) {
      reactedRef.current.add("stone");
      if (spawnItemNear(w, "moon_stone", 28, 12, 3)) showHint("河边的石头少了一块，那里多了一颗会发亮的石头。", "ok");
    }
    // 秘密：夜里多次来访 → 树下出现神秘种子
    if (!reactedRef.current.has("night") && (s.night ?? 0) >= 3) {
      reactedRef.current.add("night");
      if (spawnItemNear(w, "strange_seed", 7, 3, 2)) showHint("夜深了。你常去的树下，多了一粒奇怪的种子。", "ok");
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

  // 通用"获得一个物品"：进背包 + 图鉴 + 可选统计类别 + 保存 + 驱动 3D 重渲染
  const gainItem = useCallback(
    (itemId: string, cat?: string) => {
      setInventory((prev) => {
        const next = { ...prev, [itemId]: (prev[itemId] ?? 0) + 1 };
        try {
          localStorage.setItem(INV_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      discover(itemId);
      if (cat) statsRef.current[cat as keyof StatState] = (statsRef.current[cat as keyof StatState] ?? 0) + 1;
      saveStats();
      setWorldVersion((v) => v + 1);
    },
    [discover, saveStats],
  );

  // 拾取物品：移除 + 背包 + 图鉴 + 统计 + 森林记忆 + 全球统计 + 提示，并驱动 3D 重渲染
  const pickUpItem = useCallback(
    (item: WorldItem) => {
      const w = worldRef.current;
      removeItem(w, item);
      const def = getItem(item.itemId);
      const cat = CATEGORY[item.itemId];
      gainItem(item.itemId, cat);
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
    },
    [gainItem, checkResponses, saveStats, showHint],
  );

  // ---- 钓鱼 ----
  const clearFishTimers = useCallback(() => {
    if (fishCastTimerRef.current) window.clearTimeout(fishCastTimerRef.current);
    if (fishAutoMissRef.current) window.clearTimeout(fishAutoMissRef.current);
    fishCastTimerRef.current = null;
    fishAutoMissRef.current = null;
  }, []);

  const gainFish = useCallback(
    (fishId: string) => {
      const def = getItem(fishId);
      const rare = def.rarity === "rare";
      const starsGain = rare ? 30 : 10;
      gainItem(fishId);
      statsRef.current.stars = (statsRef.current.stars ?? 0) + starsGain;
      statsRef.current.fish = (statsRef.current.fish ?? 0) + 1;
      saveStats();
      showHint(`🎣 钓到「${def.name}」 获得 ${starsGain}⭐${rare ? "（稀有！）" : ""}`, "ok");
    },
    [gainItem, saveStats, showHint],
  );

  const finishFish = useCallback(
    (success: boolean, msg: string) => {
      clearFishTimers();
      fishPhaseRef.current = "idle";
      setFishPhase("idle");
      fishDirRef.current = 1;
      if (!success) {
        showHint(msg, "warn");
        return;
      }
      const boost = fishBaitBoostRef.current;
      fishBaitBoostRef.current = false;
      const rare = Math.random() < (boost ? 0.45 : 0.2);
      const fishId = rare
        ? Math.random() < 0.5
          ? "goldfish"
          : "glowfish"
        : ["carp", "bass", "puffer"][Math.floor(Math.random() * 3)];
      gainFish(fishId);
    },
    [clearFishTimers, showHint, gainFish],
  );

  const startFish = useCallback(() => {
    if (fishPhaseRef.current !== "idle" || !nearRiverRef.current) return;
    const bait = inventoryRef.current.bait ?? 0;
    if (bait > 0) {
      fishBaitBoostRef.current = true;
      setInventory((prev) => {
        const next = { ...prev, bait: (prev.bait ?? 0) - 1 };
        try {
          localStorage.setItem(INV_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    } else {
      fishBaitBoostRef.current = false;
    }
    fishPhaseRef.current = "casting";
    setFishPhase("casting");
    showHint("🎣 抛出鱼线，静静等待……", "ok");
    const c = 0.4 + Math.random() * 0.2;
    const half = 0.1 + Math.random() * 0.05;
    const zone: [number, number] = [Math.max(0.05, c - half), Math.min(0.95, c + half)];
    fishZoneRef.current = zone;
    setFishZone(zone);
    fishDirRef.current = 1;
    fishCursorRef.current = 0.3;
    clearFishTimers();
    fishCastTimerRef.current = window.setTimeout(() => {
      fishPhaseRef.current = "biting";
      setFishPhase("biting");
      showHint("鱼儿咬钩了！按 F / 点「收竿」！", "ok");
      fishAutoMissRef.current = window.setTimeout(() => finishFish(false, "啊……鱼儿游走了。"), 2600);
    }, 900 + Math.random() * 500);
  }, [clearFishTimers, showHint, finishFish]);

  const reelFish = useCallback(() => {
    if (fishPhaseRef.current !== "biting") return;
    const cur = fishCursorRef.current;
    const [lo, hi] = fishZoneRef.current;
    if (cur >= lo && cur <= hi) {
      finishFish(true, "");
    } else {
      finishFish(false, "哎呀，时机没抓好，鱼儿溜走了！");
    }
  }, [finishFish]);

  useEffect(() => () => clearFishTimers(), [clearFishTimers]);

  // ---- 售卖机 ----
  const buyProduct = useCallback(
    (p: VendorProduct) => {
      const stars = statsRef.current.stars ?? 0;
      if (stars < p.cost) {
        showHint(`星星不够，去河边钓点鱼吧（需要 ${p.cost}⭐）。`, "warn");
        return;
      }
      if (p.kind === "furniture") {
        const idx = house.indexOf(null);
        if (idx === -1) {
          showHint("小屋已经摆满了。", "warn");
          return;
        }
        statsRef.current.stars = stars - p.cost;
        saveStats();
        const nextHouse = [...house];
        nextHouse[idx] = p.id;
        setHouse(nextHouse);
        try { localStorage.setItem("forest_house", JSON.stringify(nextHouse)); } catch {}
        showHint(`🧾 买下「${p.name}」并摆进小屋。`, "ok");
        return;
      }
      statsRef.current.stars = stars - p.cost;
      saveStats();
      gainItem(p.id);
      showHint(`🧾 买了「${p.name}」`, "ok");
    },
    [house, gainItem, saveStats, showHint],
  );

  // ---- 小屋入口 / 售卖机 / 出售 / 睡觉 ----
  const openVending = useCallback(() => {
    setHouseTab("vending");
    setVendingTab("buy");
    setShowHouse(true);
  }, []);

  const enterHouse = useCallback(() => {
    if (sleeping) return;
    setInHouse(true);
  }, [sleeping]);

  const leaveHouse = useCallback(() => {
    if (sleeping) return;
    setInHouse(false);
  }, [sleeping]);

  const sellItem = useCallback(
    (itemId: string) => {
      const price = SELL_PRICES[itemId];
      if (!price) return;
      if ((inventory[itemId] ?? 0) <= 0) {
        showHint("背包里没有这个。", "warn");
        return;
      }
      setInventory((prev) => {
        const next = { ...prev, [itemId]: (prev[itemId] ?? 0) - 1 };
        try {
          localStorage.setItem(INV_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      statsRef.current.stars = (statsRef.current.stars ?? 0) + price;
      saveStats();
      showHint(`出售「${getItem(itemId).name}」 获得 ${price}⭐`, "ok");
    },
    [inventory, saveStats, showHint],
  );

  const sleep = useCallback(() => {
    if (sleeping) return;
    setSleeping(true);
    showHint("💤 你在柔软的床上睡着了……", "ok");
    if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = window.setTimeout(() => {
      statsRef.current.energy = 100;
      lowEnergyWarnedRef.current = false;
      saveStats();
      setSleeping(false);
      setEnergyUI(100);
      showHint("⚡ 精神完全恢复啦！", "ok");
    }, 2600);
  }, [sleeping, saveStats, showHint]);

  useEffect(() => () => {
    if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
  }, []);

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

  // 键盘：移动 + F 钓鱼
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) keyVecRef.current.y = -1;
      else if (["arrowdown", "s"].includes(k)) keyVecRef.current.y = 1;
      else if (["arrowleft", "a"].includes(k)) keyVecRef.current.x = -1;
      else if (["arrowright", "d"].includes(k)) keyVecRef.current.x = 1;
      else if (k === "e" || k === "i") setShowInv((v) => !v);
      else if (k === "f") {
        if (fishPhaseRef.current === "biting") reelFish();
        else if (fishPhaseRef.current === "idle" && nearRiverRef.current) startFish();
      }
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
  }, [startFish, reelFish]);

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

      const w = worldRef.current;
      const asleep = sleepingRef.current;
      const energyNow = statsRef.current.energy ?? 100;

      // 移动（低能量减速；睡觉时冻结）
      const vx = keyVecRef.current.x + joyVecRef.current.x;
      const vy = keyVecRef.current.y + joyVecRef.current.y;
      const moving = !asleep && (vx !== 0 || vy !== 0);
      if (moving) {
        const speedMul = energyNow < 25 ? 0.55 : 1;
        movePlayer(worldRef.current, vx * speedMul, vy * speedMul, dt);
        statsRef.current.energy = Math.max(0, energyNow - dt * 0.9);
      }

      // 自动拾取：走近物品直接捡起（无需点击）
      if (!asleep) {
        const near = pickupNearby(worldRef.current);
        if (near) pickUpItem(near);
      }

      // 神秘事件：靠近时揭示
      for (let i = mysteryRef.current.length - 1; i >= 0; i--) {
        const m = mysteryRef.current[i];
        if (Math.hypot(m.x - w.player.x, m.y - w.player.y) < TILE * 1.2) {
          mysteryRef.current.splice(i, 1);
          showHint(`${m.icon} ${m.text}`, "warn");
          setWorldVersion((v) => v + 1);
        }
      }

      // 河边检测（供钓鱼）
      const nearRiverNow = isNearRiver(worldRef.current);
      if (nearRiverNow !== nearRiverRef.current) {
        nearRiverRef.current = nearRiverNow;
        setNearRiver(nearRiverNow);
      }

      // 小屋门口检测（供进屋）
      const nearHutNow =
        Math.hypot(worldRef.current.player.x / TILE - HUT_CENTER.x, worldRef.current.player.y / TILE - HUT_CENTER.z) < 2.4;
      if (nearHutNow !== nearHutRef.current) {
        nearHutRef.current = nearHutNow;
        setNearHut(nearHutNow);
      }

      // 能量 UI 节流刷新 + 低能量一次性提示
      const energyInt = Math.round(statsRef.current.energy ?? 100);
      setEnergyUI((prev) => (prev === energyInt ? prev : energyInt));
      if (!asleep && energyInt <= 25 && !lowEnergyWarnedRef.current) {
        lowEnergyWarnedRef.current = true;
        showHint("有点累了……回小屋休息恢复体力吧。", "warn");
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
            <span>⭐ {statsRef.current.stars ?? 0}</span>
            <span className="hidden sm:inline">🐟 {statsRef.current.fish ?? 0}</span>
            <span className={cn("font-semibold", energyUI <= 25 ? "text-red-400" : "text-emerald-300")}>
              ⚡ {energyUI}
            </span>
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
              houseView={inHouse}
              houseFurniture={house}
              onVendingMachine={openVending}
              onBed={sleep}
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

          {/* 进入小屋（靠近门口时） */}
          {nearHut && !inHouse && !sleeping && (
            <button
              onClick={enterHouse}
              className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:bg-black/50"
            >
              🚪 进入小屋
            </button>
          )}

          {/* 小屋内：离开 / 休息 */}
          {inHouse && !sleeping && (
            <>
              <button
                onClick={leaveHouse}
                className="absolute left-2 top-2 z-10 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-semibold text-zinc-100 backdrop-blur transition hover:bg-black/50"
              >
                🚪 离开
              </button>
              <button
                onClick={sleep}
                className="absolute bottom-4 right-4 z-10 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:bg-black/50"
              >
                💤 休息
              </button>
            </>
          )}

          {/* 睡觉覆盖层 */}
          {sleeping && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="text-center">
                <div className="text-4xl">💤</div>
                <div className="mt-2 text-sm text-zinc-100">你在软软的床上睡着了……</div>
              </div>
            </div>
          )}

          {/* 钓鱼按钮（河边或正在钓鱼时显示） */}
          {(nearRiver || fishPhase !== "idle") && !inHouse && (
            <button
              onClick={() => {
                if (fishPhase === "biting") reelFish();
                else if (fishPhase === "idle") startFish();
              }}
              className="absolute bottom-4 right-4 z-10 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:bg-black/50"
            >
              {fishPhase === "biting" ? "🎣 收竿！" : fishPhase === "casting" ? "⏳ 等待…" : "🎣 钓鱼"}
            </button>
          )}

          {/* 钓鱼小游戏覆盖层 */}
          {fishPhase === "casting" && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black/30 px-5 py-3 text-sm text-zinc-100 backdrop-blur">
              抛竿中……静静等待鱼儿上钩……
            </div>
          )}
          {fishPhase === "biting" && (
            <FishBiteBar cursorRef={fishCursorRef} zone={fishZone} onReel={reelFish} />
          )}

          <Joystick onMove={(x, y) => (joyVecRef.current = { x, y })} />
        </div>

        <p className="text-center text-xs text-zinc-500">
          WASD / 方向键移动 · 走近物品自动拾取 · 到河边按 F 钓鱼 · E/I 开背包 · ESC 关弹窗/退出全屏
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
          {/* 切换标签 */}
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setHouseTab("furniture")}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
                houseTab === "furniture" ? "bg-orange-500/20 text-orange-200" : "bg-white/5 text-zinc-300 hover:bg-white/10",
              )}
            >
              🛋️ 家具
            </button>
            <button
              onClick={() => setHouseTab("vending")}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
                houseTab === "vending" ? "bg-orange-500/20 text-orange-200" : "bg-white/5 text-zinc-300 hover:bg-white/10",
              )}
            >
              🎰 售卖机
            </button>
          </div>

          {houseTab === "furniture" ? (
            <>
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
            </>
          ) : (
            <>
              <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm">
                我的星星：<span className="font-bold text-yellow-300">⭐ {statsRef.current.stars ?? 0}</span>
              </div>
              <div className="mb-3 flex gap-2">
                <button
                  onClick={() => setVendingTab("buy")}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    vendingTab === "buy" ? "bg-yellow-500/20 text-yellow-200" : "bg-white/5 text-zinc-300 hover:bg-white/10",
                  )}
                >
                  🛒 购买
                </button>
                <button
                  onClick={() => setVendingTab("sell")}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    vendingTab === "sell" ? "bg-yellow-500/20 text-yellow-200" : "bg-white/5 text-zinc-300 hover:bg-white/10",
                  )}
                >
                  💰 出售
                </button>
              </div>
              {vendingTab === "buy" ? (
                <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
                  {VENDOR_PRODUCTS.map((p) => {
                    const can = (statsRef.current.stars ?? 0) >= p.cost;
                    return (
                      <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{p.icon}</span>
                          <span className="text-xs font-semibold">{p.name}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{p.desc}</div>
                        <button
                          onClick={() => buyProduct(p)}
                          disabled={!can}
                          className="mt-1 w-full rounded-lg bg-yellow-500 py-1 text-xs font-semibold text-black transition hover:bg-yellow-400 disabled:opacity-40"
                        >
                          {can ? `购买 · ${p.cost}⭐` : `星星不足 ${p.cost}⭐`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
                  {inventoryEntries.filter(([id, count]) => count > 0 && SELL_PRICES[id]).length === 0 ? (
                    <p className="col-span-2 py-6 text-center text-sm text-muted-foreground">背包里没有可出售的东西。</p>
                  ) : (
                    inventoryEntries
                      .filter(([id, count]) => count > 0 && SELL_PRICES[id])
                      .map(([id, count]) => {
                        const def = getItem(id);
                        const price = SELL_PRICES[id];
                        return (
                          <div key={id} className="rounded-xl border border-white/10 bg-white/5 p-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{def.icon}</span>
                              <span className="text-xs font-semibold">{def.name}</span>
                              <span className="ml-auto text-[10px] text-zinc-400">×{count}</span>
                            </div>
                            <button
                              onClick={() => sellItem(id)}
                              className="mt-1 w-full rounded-lg bg-emerald-500 py-1 text-xs font-semibold text-black transition hover:bg-emerald-400"
                            >
                              出售 · {price}⭐
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">去河边钓鱼能获得星星。</p>
            </>
          )}
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

function FishBiteBar({
  cursorRef,
  zone,
  onReel,
}: {
  cursorRef: { current: number };
  zone: [number, number];
  onReel: () => void;
}) {
  const [cursor, setCursor] = useState(0.3);
  const dirRef = useRef(1);

  useEffect(() => {
    const id = window.setInterval(() => {
      let cur = cursorRef.current + 0.04 * dirRef.current;
      if (cur >= 1) {
        cur = 1;
        dirRef.current = -1;
      } else if (cur <= 0) {
        cur = 0;
        dirRef.current = 1;
      }
      cursorRef.current = cur;
      setCursor(cur);
    }, 50);
    return () => window.clearInterval(id);
  }, [cursorRef]);

  const [lo, hi] = zone;

  return (
    <div className="pointer-events-auto absolute bottom-20 left-1/2 z-10 w-64 -translate-x-1/2 rounded-2xl border border-white/15 bg-black/40 p-3 backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-200">
        <span>🎣 鱼儿咬钩了！</span>
        <button
          onClick={onReel}
          className="rounded-full bg-emerald-500 px-3 py-1 font-semibold text-black transition hover:bg-emerald-400"
        >
          收竿
        </button>
      </div>
      <div className="relative h-4 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 bg-emerald-400/40"
          style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }}
        />
        <div
          className="absolute inset-y-0 w-1 rounded bg-yellow-300"
          style={{ left: `calc(${cursor * 100}% - 2px)` }}
        />
      </div>
      <p className="mt-1 text-center text-[10px] text-zinc-400">指针落在绿色区时按 F / 点“收竿”</p>
    </div>
  );
}
