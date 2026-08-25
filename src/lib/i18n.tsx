"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "zh" | "en";

// 文案字典：key -> { zh, en }
const DICT: Record<string, { zh: string; en: string }> = {
  // 导航
  "nav.home": { zh: "首页", en: "Home" },
  "nav.leaderboard": { zh: "排行榜", en: "Leaderboard" },
  "nav.chat": { zh: "聊天", en: "Chat" },
  "nav.login": { zh: "登录", en: "Log in" },
  "nav.register": { zh: "注册", en: "Sign up" },
  "nav.profile": { zh: "个人中心", en: "Profile" },
  "nav.scores": { zh: "我的成绩", en: "My Scores" },
  "nav.logout": { zh: "退出登录", en: "Log out" },
  "nav.menu": { zh: "菜单", en: "Menu" },

  // 首页
  "home.title": { zh: "小鱼 Game Center", en: "Fish Game Center" },
  "home.short": { zh: "小鱼", en: "Fish" },
  "home.sub": { zh: "简单好玩的在线小游戏合集，刷新全球排行榜！", en: "Fun online mini-games. Climb the global leaderboard!" },
  "home.play": { zh: "🎮 选择游戏", en: "🎮 Play Games" },
  "home.leaderboard": { zh: "排行榜", en: "Leaderboard" },
  "home.more": { zh: "更多小游戏", en: "More Games" },
  "home.moreSub": { zh: "更多小游戏持续上新", en: "More games coming soon" },
  "home.enterForest": { zh: "进入森林", en: "Enter Forest" },
  "home.available": { zh: "可玩", en: "Playable" },
  "home.comingSoon": { zh: "敬请期待", en: "Coming Soon" },
  "footer.sub": { zh: "用 Next.js + Supabase 构建 · 更多小游戏持续上新中", en: "Built with Next.js + Supabase · More games coming soon" },

  // 游戏（标题/简介）
  "game.basketball.title": { zh: "投篮挑战", en: "Basketball" },
  "game.basketball.desc": { zh: "60 秒限时投篮，挑战你的命中率与连击！", en: "60-second shooting challenge. Test your accuracy and combos!" },
  "game.snake.title": { zh: "贪吃蛇", en: "Snake" },
  "game.snake.desc": { zh: "经典贪吃蛇，吃豆变长，挑战更高分！", en: "Classic snake. Eat, grow, and chase the top score!" },
  "game.2048.title": { zh: "2048", en: "2048" },
  "game.2048.desc": { zh: "合并数字方块，冲击 2048！", en: "Merge tiles and reach 2048!" },
  "game.memory.title": { zh: "记忆翻牌", en: "Memory" },
  "game.memory.desc": { zh: "翻开卡片，找出所有配对，越少步数越好！", en: "Flip cards and match pairs in fewer moves!" },
  "game.pong.title": { zh: "Pong", en: "Pong" },
  "game.pong.desc": { zh: "经典乒乓球对打，让 AI 接不住！", en: "Classic table tennis — outsmart the AI!" },
  "game.reaction.title": { zh: "点击反应", en: "Reaction" },
  "game.reaction.desc": { zh: "等变绿了立刻点击，测试你的反应速度！", en: "Click the moment it turns green. How fast are you?" },
  "game.racing.title": { zh: "赛车", en: "Racing" },
  "game.racing.desc": { zh: "左右躲避来车，活得越久分越高！", en: "Dodge oncoming cars. Survive longer for a higher score!" },
  "game.forest.title": { zh: "森林里好像有什么", en: "Something in the Forest" },
  "game.forest.desc": { zh: "我只是来捡几根树枝的。", en: "I just came to pick up some sticks." },

  // 难度
  "diff.easy": { zh: "简单", en: "Easy" },
  "diff.normal": { zh: "普通", en: "Normal" },
  "diff.hard": { zh: "困难", en: "Hard" },
};

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: string) => string;
  /** 中文 → 当前语言（英文未收录时原样返回）。 */
  tt: (zh: string) => string;
  /** 带插值：zh 模板里的 {key} 会被 params 填充；英文未收录时用中文模板。 */
  tf: (zh: string, params?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: "zh",
  setLang: () => {},
  toggle: () => {},
  t: (key) => key,
  tt: (zh) => zh,
  tf: (zh) => zh,
});

function fill(tpl: string, params?: Record<string, string | number>): string {
  if (!params) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

// 森林等物品/家具/界面文案：中文 → 英文（含 {key} 插值）
const EN: Record<string, string> = {
  // 昼夜 / 天气 / 状态
  清晨: "Morning", 白天: "Day", 黄昏: "Dusk", 夜晚: "Night",
  下雨: "Rainy", 晴朗: "Sunny", 已登录: "Signed in", 游客: "Guest",

  // 顶部按钮
  图鉴: "Journal", 背包: "Backpack", 小屋: "Cabin", 全屏: "Fullscreen", 退出全屏: "Exit fullscreen",

  // 全球统计
  "🌍 今日全部玩家：捡起 {a} · 蘑菇 {b} · 探索 {c}": "🌍 Today all players: Picked {a} · Mushrooms {b} · Explored {c}",

  // 钓鱼
  钓鱼: "Fish", 收竿: "Reel!", 等待: "Waiting…",
  "🎣 到河边了，按 F（或点“钓鱼”）抛竿！": "🎣 At the river! Press F (or tap Fish) to cast!",
  "🎣 抛出鱼线，静静等待……": "🎣 You cast your line… wait for a bite…",
  "鱼儿咬钩了！按 F / 点「收竿」！": "A bite! Press F / tap Reel!",
  "鱼儿咬钩了！": "A bite!",
  "抛竿中……静静等待鱼儿上钩……": "Casting… waiting for a bite…",
  "指针落在绿色区时按 F / 点“收竿”": "Reel (F) when the cursor is in the green zone",
  "哎呀，时机没抓好，鱼儿溜走了！": "Oops, bad timing — the fish got away!",
  "啊……鱼儿游走了。": "Ah… the fish swam away.",

  // 钓鱼产物提示
  "🎣 钓到「{name}」 获得 {n}⭐（稀有！）": "🎣 Caught \"{name}\" for {n}⭐ (Rare!)",
  "🎣 钓到「{name}」 获得 {n}⭐": "🎣 Caught \"{name}\" for {n}⭐",

  // 小屋
  "进入小屋": "Enter Cabin", "离开小屋": "Leave Cabin", "上床休息": "Take a rest", 休息: "Rest",
  "你在软软的床上睡着了……": "You fall asleep on the soft bed…",
  "💤 你在柔软的床上睡着了……": "💤 You fall asleep on the soft bed…",
  "⚡ 精神完全恢复啦！": "⚡ Fully rested!",
  "有点累了……回小屋休息恢复体力吧。": "A bit tired… rest in the cabin to recover.",
  "🏠 到家了～点“进入小屋”可以进去看看。": "🏠 Home! Tap Enter Cabin to go inside.",
  家具: "Furniture", 售卖机: "Vending Machine",
  "点已摆放的家具可收起": "Tap a placed piece to remove it",
  摆放: "Place", "资源不足": "Not enough resources",
  "我的星星：⭐ {n}": "My stars: ⭐ {n}", 购买: "Buy", 出售: "Sell",
  "购买 · {n}⭐": "Buy · {n}⭐", "星星不足 {n}⭐": "Not enough stars {n}⭐", "出售 · {n}⭐": "Sell · {n}⭐",
  "背包里没有可出售的东西。": "Nothing sellable in your backpack.",
  "去河边钓鱼能获得星星。": "Go fish by the river to earn stars.",
  "🧾 买下「{name}」并摆进小屋。": "🧾 Bought \"{name}\" and placed it in the cabin.",
  "🧾 买了「{name}」": "🧾 Bought \"{name}\".",
  "购买的家具已摆进小屋。": "Bought furniture placed in the cabin.",
  "星星不够，去河边钓点鱼吧（需要 {n}⭐）。": "Not enough stars (need {n}⭐). Go fish by the river.",
  "在屋里摆了「{name}」": "Placed \"{name}\" in the cabin.",
  "资源不够，去森林里多捡一点吧。": "Not enough resources. Pick more in the forest.",
  "小屋已经摆满了。": "The cabin is full.",
  "背包空空如也，去森林里捡点东西吧。": "Your backpack is empty. Pick up something from the forest.",
  稀有: "Rare", 普通: "Common",
  "已发现 {a} / {b} 种事物": "Discovered {a} / {b} things",
  未发现: "Undiscovered",
  "森林图鉴": "Forest Journal", "🎒 背包": "🎒 Backpack", "🏠 小屋": "🏠 Cabin",

  // 帮助图例
  移动: "Move", "走近自动拾取": "Auto-pickup close-by", "先关弹窗 · 再退全屏": "Close popups · then exit fullscreen",
  关闭: "Close",
  "WASD": "WASD", "方向键": "Arrows",
  "WASD / 方向键 移动": "WASD / Arrows Move", "F 钓鱼": "F Fish", "E/I 背包": "E/I Backpack",
  "靠近门口 🚪 进小屋": "Near the door to enter 🚪", "ESC 先关弹窗 · 再退全屏": "ESC close popups · then exit fullscreen",

  // 物品名
  普通树枝: "Twig", 落叶: "Fallen Leaf", 石头: "Stone", 松果: "Pinecone", 普通蘑菇: "Mushroom",
  野花: "Wildflower", 羽毛: "Feather", 发光树枝: "Glowing Branch", 蓝色蘑菇: "Blue Mushroom",
  奇怪的羽毛: "Strange Feather", 月光石: "Moonstone", 奇怪的种子: "Strange Seed", 鲤鱼: "Carp",
  鲈鱼: "Bass", 气鼓鼓: "Pufferfish", 小金鱼: "Goldfish", 发光鱼: "Glowfish", 四叶草: "Clover",
  河贝: "River Shell", 青玉: "Jade", 河珍珠: "Pearl",

  // 物品描述
  "很普通的一根树枝。": "Just an ordinary twig.",
  "一片被山风不小心吹下来的叶子。": "A leaf the mountain breeze dropped.",
  "一块圆圆的、凉凉的石头。": "A round, cool stone.",
  "不知道哪棵松树掉的。": "Dropped by some pine tree.",
  "看起来可以吃，但最好别吃。": "Looks edible, but better not to.",
  "一朵不知道名字的小花。": "A little flower with no name.",
  "很轻，轻到几乎感觉不到。": "So light you can barely feel it.",
  "它为什么会发光？": "Why does it glow?",
  "森林里好像没有人种过它。": "Nobody in the forest seems to have planted it.",
  "森林里没有这种鸟。": "No bird like this lives in the forest.",
  "月亮出来的时候，它会亮一下。": "It glows when the moon is out.",
  "不知道会长出什么。": "Who knows what it will grow into.",
  "扑通一声，又跳回水里去了。": "Splash! Back into the water.",
  "最合适红烧的那一种。": "The kind that's best braised.",
  "你一碰它，它就鼓起来了。": "Puff up the moment you touch it.",
  "金色的，闪亮亮的。": "Golden and sparkly.",
  "夜里看它，自己也亮了起来。": "At night, you start to glow too.",
  "据说找到它的人会走运。": "They say finding it brings luck.",
  "被河水冲得圆圆的，凉凉的。": "Washed round and cool by the river.",
  "被河水冲得温润的青玉。": "A jade smoothed by the river.",
  "月亮见过它，它见过月亮。": "The moon has seen it; it has seen the moon.",

  // 家具名 / 描述
  木桌: "Wooden Table", 木椅: "Wooden Chair", 树枝风铃: "Twig Chime", 蘑菇灯: "Mushroom Lamp",
  石头装饰: "Stone Decor", 花盆: "Flower Pot", 羽毛挂饰: "Feather Hanging", "不会走的钟": "Clock That Won't Move",
  "温热的石头": "Warm Stone", "没人弹的钢琴": "Unplayed Piano",
  "一张结实的木桌。": "A sturdy wooden table.",
  "坐上去会咯吱响。": "Creaks when you sit on it.",
  "风一吹就轻轻响。": "Chimes softly in the wind.",
  "幽幽地亮着。": "Glows faintly.",
  "圆圆的，很安静。": "Round and quiet.",
  "里面种着一朵不知名的小花。": "Holds an unnamed flower.",
  "轻轻地晃着。": "Sways gently.",
  "它好像从来不指向同一个时间。": "It never seems to show the same time.",
  "你盯着它的时候，它偷偷停了一下。": "When you stare, it secretly stops.",
  "摸起来是温的。": "Warm to the touch.",
  "它自己会暖起来。": "It warms on its own.",
  "偶尔会自己响一下。": "Sometimes it plays by itself.",
  "你不在的时候，它好像弹过。": "When you're away, it seems to have played.",

  // 售卖机商品（此处只收录与物品名/描述不重复的键）
  "特制鱼饵": "Special Bait",
  "蘑菇灯（家具）": "Mushroom Lamp (Furniture)", "不会走的钟（家具）": "Clock That Won't Move (Furniture)",
  "没人弹的钢琴（家具）": "Unplayed Piano (Furniture)",
  "钓鱼时提高稀有鱼出现率（每次消耗一粒）": "Boosts rare fish chance while fishing (1 per cast)",
  "买回去，它会陪着你。": "Keep it and it will stay with you.",
  "夜里，它自己会亮。": "At night it glows on its own.",
  "买回来亮晶晶的。": "Buy it — it sparkles.",
  "月光见过它。": "The moonlight has seen it.",
  "摆进小屋。": "Place it in the cabin.",

  // 森林记忆 / 神秘事件
  "森林好像在你常捡树枝的地方，开了一朵花。": "A flower bloomed where you often gather twigs.",
  "你捡了很多蘑菇……森林里冒出一株蓝色的。": "You picked a lot of mushrooms… a blue one sprouted.",
  "河边的石头少了一块，那里多了一颗会发亮的石头。": "A stone by the river is gone — a glowing one appeared.",
  "夜深了。你常去的树下，多了一粒奇怪的种子。": "Late at night. Under your favorite tree, a strange seed appeared.",
  "一串脚印延伸进树林深处……": "A trail of footprints leads into the woods…",
  "这根树枝，好像刚刚才被折断。": "This twig seems freshly snapped.",
  "你确定，昨天这里还没有这个石堆。": "Are you sure this heap wasn't here yesterday?",
  "一个发着微弱蓝光的蘑菇，安静地长着。": "A mushroom glinting faint blue, growing quietly.",
  "你似乎看见远处有一双小眼睛，可一靠近就没了。": "You thought you saw tiny eyes far away… gone when you got close.",
  "（稀有！）": " (Rare!)",
  "· 月光下它似乎更亮了": "· It seemed brighter in the moonlight",
  "拾起「{name}」{rare}": "Picked up \"{name}\"{rare}",
  "走近一点才能捡起": "Get closer to pick it up",
  "出售「{name}」 获得 {n}⭐": "Sold \"{name}\" for {n}⭐",
  "背包里没有这个。": "You don't have that in your backpack.",
  "这个暂时不能卖。": "That can't be sold yet.",
};

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    let initial: Lang = "zh";
    try {
      const s = localStorage.getItem("lang");
      if (s === "zh" || s === "en") initial = s;
    } catch {
      // ignore
    }
    setLangState(initial);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setLangState((prev) => {
      const next: Lang = prev === "zh" ? "en" : "zh";
      try {
        localStorage.setItem("lang", next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string) => {
      const d = DICT[key];
      if (!d) return key;
      return d[lang];
    },
    [lang],
  );

  const tt = useCallback(
    (zh: string) => (lang === "en" ? EN[zh] ?? zh : zh),
    [lang],
  );

  const tf = useCallback(
    (zh: string, params?: Record<string, string | number>) =>
      lang === "en" ? fill(EN[zh] ?? zh, params) : fill(zh, params),
    [lang],
  );

  return <LangContext.Provider value={{ lang, setLang, toggle, t, tt, tf }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
