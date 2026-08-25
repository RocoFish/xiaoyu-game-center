// 小屋家具定义（原创）：可用森林资源换取并摆放。
export interface FurnitureDef {
  id: string;
  name: string;
  icon: string;
  cost: Partial<Record<string, number>>; // 物品id -> 数量
  desc?: string;
  weird?: string; // 神秘家具的隐藏描述
}

export const FURNITURE: FurnitureDef[] = [
  { id: "table", name: "木桌", icon: "🪑", cost: { stick: 3 }, desc: "一张结实的木桌。" },
  { id: "chair", name: "木椅", icon: "🪑", cost: { stick: 2 }, desc: "坐上去会咯吱响。" },
  { id: "chime", name: "树枝风铃", icon: "🎐", cost: { stick: 2, feather: 1 }, desc: "风一吹就轻轻响。" },
  { id: "lamp", name: "蘑菇灯", icon: "🪔", cost: { mushroom: 2 }, desc: "幽幽地亮着。" },
  { id: "stone", name: "石头装饰", icon: "🪨", cost: { stone: 2 }, desc: "圆圆的，很安静。" },
  { id: "pot", name: "花盆", icon: "🪴", cost: { flower: 2 }, desc: "里面种着一朵不知名的小花。" },
  { id: "feather", name: "羽毛挂饰", icon: "🪶", cost: { feather: 2 }, desc: "轻轻地晃着。" },
  { id: "clock", name: "不会走的钟", icon: "🕰️", cost: { stone: 3, stick: 1 }, desc: "它好像从来不指向同一个时间。", weird: "你盯着它的时候，它偷偷停了一下。" },
  { id: "warmstone", name: "温热的石头", icon: "🪨", cost: { stone: 3 }, desc: "摸起来是温的。", weird: "它自己会暖起来。" },
  { id: "piano", name: "没人弹的钢琴", icon: "🎹", cost: { stick: 5, flower: 2 }, desc: "偶尔会自己响一下。", weird: "你不在的时候，它好像弹过。" },
];

export function getFurniture(id: string): FurnitureDef | undefined {
  return FURNITURE.find((f) => f.id === id);
}
