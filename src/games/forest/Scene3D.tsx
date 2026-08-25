"use client";

// 森林 3D 场景：低多边形 + 柔和光照 + 鲜明色彩 + 雾景深（原创、程序生成，无外部素材）。
// 本组件只负责"视觉呈现"：每一帧读取 ForestGame 传入的 ref（时间/天气/世界/神秘事件），
// 不推进游戏逻辑（移动/拾取由 ForestGame 的主循环负责），避免"双 tick"。
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { MAP_W, MAP_H, TILE, TYPES, type World, type WorldItem } from "./engine";
import { getItem } from "./items";

export interface MysteryMarker {
  x: number;
  y: number;
  icon: string;
  text: string;
}

interface SceneProps {
  world: World;
  timeRef: { current: number };
  weatherRef: { current: "sunny" | "rain" };
  mysteryRef: { current: MysteryMarker[] };
  /** 拾取/生成/移除世界物品或神秘标记时递增，用来触发 3D 层重渲染。 */
  worldVersion: number;
  /** 最近一次移动方向（用于角色朝向）。 */
  playerDirRef: { current: { x: number; z: number } };
}

const DAY_CYCLE = 240;

type RGB = [number, number, number];

function skyColor(p: number, weather: "sunny" | "rain"): RGB {
  if (weather === "rain") return [0.42, 0.46, 0.52]; // 阴雨：柔和灰蓝
  if (p < 0.25) return [0.98, 0.72, 0.44]; // 清晨：暖橙
  if (p < 0.55) return [0.4, 0.72, 0.86]; // 白天：清新蓝
  if (p < 0.78) return [0.95, 0.54, 0.28]; // 黄昏：暖橘
  return [0.07, 0.1, 0.22]; // 夜晚：深蓝
}

// 随机种子（尽量稳定，避免每次重渲染都抖）：simple LCG
function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ---- 低多边形元素 ----

function Tree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.2, 0.9, 6]} />
        <meshLambertMaterial color="#8d5524" flatShading />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <coneGeometry args={[0.8, 1.7, 7]} />
        <meshLambertMaterial color="#3fa34d" flatShading />
      </mesh>
      <mesh position={[0, 1.95, 0]} castShadow>
        <coneGeometry args={[0.55, 1.1, 7]} />
        <meshLambertMaterial color="#54b85a" flatShading />
      </mesh>
    </group>
  );
}

function Rock({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.22, z]} scale={[0.5, 0.34, 0.44]} castShadow>
      <dodecahedronGeometry args={[0.5, 0]} />
      <meshLambertMaterial color="#a8a49b" flatShading />
    </mesh>
  );
}

function Mushroom({ x, z, blue }: { x: number; z: number; blue?: boolean }) {
  const cap = blue ? "#4c8ff7" : "#c9474c";
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.08, 0.11, 0.26, 6]} />
        <meshLambertMaterial color="#e7d3b0" flatShading />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshLambertMaterial color={cap} flatShading />
      </mesh>
    </group>
  );
}

const FLOWER_COLORS = ["#f7c948", "#ef7b7b", "#9b7ede", "#f2a65a", "#6fd3c7"];

function Flower({ x, z, color }: { x: number; z: number; color: string }) {
  const seed = useMemo(() => Math.abs(Math.floor(x * 131 + z * 37)) % FLOWER_COLORS.length, [x, z]);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.28, 4]} />
        <meshLambertMaterial color="#3f7d3a" />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <icosahedronGeometry args={[0.1, 0]} />
        <meshLambertMaterial color={FLOWER_COLORS[seed]} flatShading />
      </mesh>
    </group>
  );
}

// 一丛小草，点缀低多边形森林
function GrassTuft({ x, z, hue }: { x: number; z: number; hue: number }) {
  const blades = useMemo(() => {
    const rnd = seededRandom(Math.floor(x * 1000 + z * 71 + hue));
    return Array.from({ length: 3 }, (_, i) => ({
      x: (rnd() - 0.5) * 0.3,
      z: (rnd() - 0.5) * 0.3,
      rot: rnd() * Math.PI,
      len: 0.22 + rnd() * 0.16,
    }));
  }, [x, z, hue]);
  return (
    <group position={[x, 0, z]}>
      {blades.map((b, i) => (
        <mesh key={i} position={[b.x, b.len / 2, b.z]} rotation={[0, b.rot, 0]}>
          <coneGeometry args={[0.045, b.len, 4]} />
          <meshLambertMaterial color="#4c9a4c" flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Hut({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[1.7, 1.2, 1.5]} />
        <meshLambertMaterial color="#9a6a3a" flatShading />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <coneGeometry args={[1.35, 1.1, 4]} />
        <meshLambertMaterial color="#c67c4f" flatShading />
      </mesh>
      {/* 门 + 窗，增加生活气息 */}
      <mesh position={[0, 0.55, 0.76]}>
        <boxGeometry args={[0.35, 0.6, 0.02]} />
        <meshLambertMaterial color="#5b3a1d" />
      </mesh>
      <mesh position={[0.42, 0.7, 0.76]}>
        <circleGeometry args={[0.12, 8]} />
        <meshLambertMaterial color="#ffe9a8" emissive="#7a5a12" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.42, 0.7, 0.76]}>
        <circleGeometry args={[0.12, 8]} />
        <meshLambertMaterial color="#ffe9a8" emissive="#7a5a12" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function Player({ world, dirRef }: { world: World; dirRef: { current: { x: number; z: number } } }) {
  const ref = useRef<THREE.Group>(null);
  const last = useRef({ x: 0, z: 0 });

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const tx = world.player.x / TILE;
    const tz = world.player.y / TILE;
    g.position.set(tx, 0, tz);
    // 朝向：沿最近移动方向缓慢转身
    const dx = tx - last.current.x;
    const dz = tz - last.current.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.0008) {
      const ang = Math.atan2(dx, dz);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, ang, 0.18);
      last.current = { x: tx, z: tz };
      dirRef.current = { x: dx, z: dz };
    }
  });

  return (
    <group ref={ref}>
      {/* 身体 */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.3, 0.7, 8]} />
        <meshLambertMaterial color="#f4a261" flatShading />
      </mesh>
      {/* 头 */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshLambertMaterial color="#fce4c1" flatShading />
      </mesh>
      {/* 眼睛（小圆点，位于 +Z 方向） */}
      <mesh position={[0.08, 1.08, 0.19]}>
        <sphereGeometry args={[0.035, 6, 5]} />
        <meshLambertMaterial color="#3a2b1f" />
      </mesh>
      <mesh position={[-0.08, 1.08, 0.19]}>
        <sphereGeometry args={[0.035, 6, 5]} />
        <meshLambertMaterial color="#3a2b1f" />
      </mesh>
    </group>
  );
}

function ItemMesh({ item, index }: { item: WorldItem; index: number }) {
  const ref = useRef<THREE.Group>(null);
  const def = getItem(item.itemId);
  const rare = def.rarity === "rare";
  const color = rare ? "#ffd166" : item.itemId === "mushroom" ? "#c9474c" : "#e7d3b0";

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime + index * 0.7;
    g.position.y = 0.24 + Math.sin(t * 2.2) * 0.05;
    g.rotation.y += 0.012;
    const s = rare ? 1 + Math.sin(t * 3) * 0.05 : 1;
    g.scale.setScalar(s);
  });

  return (
    <group ref={ref} position={[item.x / TILE, 0, item.y / TILE]}>
      <mesh castShadow>
        <icosahedronGeometry args={[0.2, 0]} />
        <meshLambertMaterial
          color={color}
          flatShading
          emissive={rare ? "#5a3a00" : "#000000"}
          emissiveIntensity={rare ? 0.6 : 0}
        />
      </mesh>
    </group>
  );
}

function MysteryMarker({ m }: { m: MysteryMarker }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.position.y = 0.5 + Math.sin(t * 2.5) * 0.1;
    g.rotation.y = t * 0.8;
    g.scale.setScalar(1 + Math.sin(t * 4) * 0.12);
  });
  return (
    <group ref={ref} position={[m.x / TILE, 0.5, m.y / TILE]}>
      <mesh>
        <octahedronGeometry args={[0.22, 0]} />
        <meshLambertMaterial color="#b48df2" emissive="#5b2a9c" emissiveIntensity={0.8} flatShading />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshBasicMaterial color="#c9aaff" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---- 氛围粒子（萤火虫 / 蝴蝶 / 雨）----

function Fireflies({ timeRef }: { timeRef: { current: number } }) {
  const ref = useRef<THREE.Group>(null);
  const seeds = useMemo(() => Array.from({ length: 16 }, (_, i) => i * 1.7 + 0.3), []);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const p = (timeRef.current % DAY_CYCLE) / DAY_CYCLE;
    const visible = p >= 0.55;
    g.visible = visible;
    if (!visible) return;
    const t = timeRef.current;
    for (let i = 0; i < g.children.length && i < seeds.length; i++) {
      const c = g.children[i];
      const s = seeds[i];
      c.position.set(
        Math.sin(t * 0.5 + s) * (0.3 + (i % 5) * 0.12) + 6 + ((i * 13) % 14),
        0.6 + Math.cos(t * 0.7 + s) * 0.4 + (i % 3),
        Math.cos(t * 0.4 + s) * 0.3 + 4 + ((i * 17) % 10),
      );
    }
  });
  return (
    <group ref={ref} visible={false}>
      {seeds.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.045, 6, 5]} />
          <meshBasicMaterial color="#fff1a8" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Butterflies({ timeRef, weatherRef }: { timeRef: { current: number }; weatherRef: { current: "sunny" | "rain" } }) {
  const ref = useRef<THREE.Group>(null);
  const seeds = useMemo(() => Array.from({ length: 7 }, (_, i) => i * 2.1 + 0.7), []);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const p = (timeRef.current % DAY_CYCLE) / DAY_CYCLE;
    const visible = weatherRef.current === "sunny" && p >= 0.1 && p < 0.55;
    g.visible = visible;
    if (!visible) return;
    const t = timeRef.current;
    for (let i = 0; i < g.children.length && i < seeds.length; i++) {
      const c = g.children[i];
      const s = seeds[i];
      c.position.set(
        Math.sin(t * 0.8 + s) * 4 + 6 + ((i * 11) % 12),
        1.4 + Math.sin(t * 1.1 + s) * 0.6,
        Math.cos(t * 0.7 + s) * 4 + 4 + ((i * 19) % 9),
      );
      c.rotation.y = Math.sin(t * 1.6 + s) * 0.9;
    }
  });
  return (
    <group ref={ref} visible={false}>
      {seeds.map((_, i) => (
        <mesh key={i}>
          <boxGeometry args={[0.14, 0.06, 0.22]} />
          <meshLambertMaterial color={i % 2 ? "#ffd166" : "#ff8fa3"} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Rain({ timeRef, weatherRef }: { timeRef: { current: number }; weatherRef: { current: "sunny" | "rain" } }) {
  const ref = useRef<THREE.Group>(null);
  const drops = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        x: (i * 7.3) % MAP_W,
        z: (i * 11.7) % MAP_H,
        speed: 6 + (i % 5),
        len: 0.5 + (i % 3) * 0.16,
      })),
    [],
  );
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const visible = weatherRef.current === "rain";
    g.visible = visible;
    if (!visible) return;
    const t = timeRef.current;
    for (let i = 0; i < g.children.length && i < drops.length; i++) {
      const c = g.children[i];
      const d = drops[i];
      const fall = (t * d.speed + i * 1.3) % 12;
      c.position.set(d.x, 6 - fall, d.z);
    }
  });
  return (
    <group ref={ref} visible={false}>
      {drops.map((d, i) => (
        <mesh key={i}>
          <boxGeometry args={[0.02, d.len, 0.02]} />
          <meshBasicMaterial color="#bfe0ff" transparent opacity={0.5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ---- 场景主体 ----

function SceneInner({ world, timeRef, weatherRef, mysteryRef, worldVersion, playerDirRef }: SceneProps) {
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const bgColor = useRef(new THREE.Color()).current;
  const fogRef = useRef(new THREE.Fog(0x88b8e0, 10, 30)).current;

  useEffect(() => {
    if (dirRef.current) {
      dirRef.current.target.position.set(MAP_W / 2, 0, MAP_H / 2);
      dirRef.current.target.updateMatrixWorld();
    }
  }, []);

  useFrame((state) => {
    const p = (timeRef.current % DAY_CYCLE) / DAY_CYCLE;
    const [r, g, b] = skyColor(p, weatherRef.current);
    bgColor.setRGB(r, g, b);
    if (state.scene) {
      state.scene.background = bgColor;
      fogRef.color.setRGB(r, g, b);
      state.scene.fog = fogRef;
    }
    if (dirRef.current) {
      const day = p < 0.78;
      dirRef.current.intensity = day ? 1.05 : 0.4;
      dirRef.current.color.set(day ? "#fff3dd" : "#ffb27a");
    }
  });

  const trees = useMemo(() => {
    const arr: { x: number; z: number }[] = [];
    for (let ty = 0; ty < MAP_H; ty++)
      for (let tx = 0; tx < MAP_W; tx++)
        if (world.map[ty][tx] === TYPES.TREE) arr.push({ x: tx + 0.5, z: ty + 0.5 });
    return arr;
  }, [world]);

  const flowers = useMemo(() => {
    const arr: { x: number; z: number }[] = [];
    for (let ty = 0; ty < MAP_H; ty++)
      for (let tx = 0; tx < MAP_W; tx++) if (world.map[ty][tx] === TYPES.FLOWER) arr.push({ x: tx + 0.5, z: ty + 0.5 });
    return arr;
  }, [world]);

  const pathTiles = useMemo(() => {
    const arr: { x: number; z: number }[] = [];
    for (let ty = 0; ty < MAP_H; ty++)
      for (let tx = 0; tx < MAP_W; tx++) if (world.map[ty][tx] === TYPES.PATH) arr.push({ x: tx + 0.5, z: ty + 0.5 });
    return arr;
  }, [world]);

  const grass = useMemo(() => {
    const rnd = seededRandom(20240516);
    const arr: { x: number; z: number; hue: number }[] = [];
    for (let i = 0; i < 90; i++) {
      const tx = 1 + rnd() * (MAP_W - 2);
      const tz = 1 + rnd() * (MAP_H - 2);
      const tile = world.map[Math.floor(tz)]?.[Math.floor(tx)];
      if (tile === TYPES.GRASS) arr.push({ x: tx, z: tz, hue: i });
    }
    return arr;
  }, [world]);

  // 低多边形河床石头装饰
  const riverRocks = useMemo(() => {
    const rnd = seededRandom(9917);
    const arr: { x: number; z: number; sx: number; sz: number }[] = [];
    for (let i = 0; i < 8; i++) arr.push({ x: 19.5 + (rnd() - 0.5) * 0.8, z: 2 + rnd() * (MAP_H - 4), sx: 0.2 + rnd() * 0.3, sz: 0.16 + rnd() * 0.2 });
    return arr;
  }, []);

  return (
    <>
      <ambientLight intensity={0.55} color="#fff7e6" />
      <hemisphereLight intensity={0.45} color="#cfeaff" groundColor="#4c8c46" />
      <directionalLight
        ref={dirRef}
        position={[15, 24, 3]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
      >
        <object3D attach="target" position={[MAP_W / 2, 0, MAP_H / 2]} />
      </directionalLight>

      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[MAP_W / 2, 0, MAP_H / 2]} receiveShadow>
        <planeGeometry args={[MAP_W, MAP_H]} />
        <meshLambertMaterial color="#6ab04c" />
      </mesh>

      {/* 小路（低多边形平板） */}
      {pathTiles.map((t, i) => (
        <mesh key={`p-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[t.x, 0.01, t.z]} receiveShadow>
          <planeGeometry args={[1, 1]} />
          <meshLambertMaterial color="#d9b382" />
        </mesh>
      ))}

      {/* 河 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[19.5, 0.02, MAP_H / 2]} receiveShadow>
        <planeGeometry args={[1.3, MAP_H]} />
        <meshLambertMaterial color="#3f9bd0" emissive="#0e3a52" emissiveIntensity={0.35} />
      </mesh>
      {riverRocks.map((r, i) => (
        <mesh key={`rr-${i}`} position={[r.x, 0.05, r.z]} scale={[r.sx, r.sz, r.sx * 0.8]} receiveShadow>
          <dodecahedronGeometry args={[0.3, 0]} />
          <meshLambertMaterial color="#7f9aa8" flatShading />
        </mesh>
      ))}

      {/* 树 / 花 / 草 / 小屋 */}
      {trees.map((t, i) => (
        <Tree key={`t-${i}`} x={t.x} z={t.z} />
      ))}
      {flowers.map((f, i) => (
        <Flower key={`f-${i}`} x={f.x} z={f.z} color={FLOWER_COLORS[i % FLOWER_COLORS.length]} />
      ))}
      {grass.map((g, i) => (
        <GrassTuft key={`g-${i}`} x={g.x} z={g.z} hue={g.hue} />
      ))}
      <Hut x={3.5} z={2.5} />
      <Rock x={12.8} z={11} />
      <Rock x={17.2} z={6.5} />

      {/* 物品（worldVersion 变化时重渲染，支持拾取后消失） */}
      {world.items.map((it, i) => (
        <ItemMesh key={`${it.itemId}-${it.x}-${it.y}`} item={it} index={i} />
      ))}

      {/* 神秘事件标记 */}
      {mysteryRef.current.map((m) => (
        <MysteryMarker key={`mk-${m.x}-${m.y}`} m={m} />
      ))}

      <Player world={world} dirRef={playerDirRef} />

      <Fireflies timeRef={timeRef} />
      <Butterflies timeRef={timeRef} weatherRef={weatherRef} />
      <Rain timeRef={timeRef} weatherRef={weatherRef} />
    </>
  );
}

export function ForestScene3D(props: SceneProps) {
  return (
    <Canvas
      camera={{ position: [MAP_W / 2, 24, MAP_H / 2 + 21], fov: 45, near: 0.1, far: 200 }}
      shadows
      dpr={[1, 1.5]}
      onCreated={({ camera }) => camera.lookAt(MAP_W / 2, 0, MAP_H / 2)}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true }}
    >
      <SceneInner {...props} />
    </Canvas>
  );
}
