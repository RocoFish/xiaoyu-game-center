# 🏀 小鱼 Game Center

一个可部署到公网的在线小游戏网站。第一版核心游戏为「投篮挑战」，并预留了模块化架构以便持续添加贪吃蛇、2048、记忆翻牌、Pong 等更多小游戏。

## 功能

- **投篮挑战**：60 秒限时投篮，三档难度（简单 / 普通 / 困难），拖拽瞄准、物理抛物线、篮板/篮筐碰撞、连击反馈（SWISH! +2、🔥 N 连中）。
- **账号系统**：Supabase Auth 注册 / 登录 / 登出，用户名与头像设置。
- **排行榜**：今日 / 本周 / 历史三档，显示排名、头像、用户名、分数、命中率、难度、日期；登录用户可查看自己的排名。
- **个人中心**：历史最高分、总游戏次数、最高命中率、最高连中、最近记录，以及「我的成绩」完整列表。
- **深色 / 浅色模式**：默认深色（黑 + 篮球橙），可一键切换。
- **响应式**：手机 / 平板 / 桌面全适配，触摸与鼠标均可操作。

## 技术栈

- [Next.js](https://nextjs.org/)（App Router，TypeScript）
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Supabase](https://supabase.com/)（Auth + PostgreSQL + Storage）
- 部署：[Vercel](https://vercel.com/) + GitHub

## 项目结构

```
src/
  app/              页面与 API 路由（首页/登录/注册/游戏/排行榜/个人中心/成绩）
    api/            服务端接口（发放游戏令牌、提交并校验成绩）
  games/            游戏模块（registry.ts 注册表 + basketball/ 投篮挑战）
  components/       通用 UI（导航/卡片/表单/排行榜/主题切换等）
  hooks/            useAuth / useLeaderboard / usePlayerStats
  lib/              Supabase 客户端、防作弊校验、工具函数
  types/            共享类型
supabase/migrations/ 数据库初始化 SQL（建表 + RLS + 触发器 + 存储桶）
```

**新增一个小游戏的步骤**：在 `src/games/` 下新建目录实现游戏，再在 `src/games/registry.ts` 登记元数据，最后在对应页面用 `dynamic()` 加载组件即可，无需改动首页、导航或排行榜。

## 本地开发

要求 Node.js 18.18+（建议 20+）。

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（见下方「环境变量」）
cp .env.example .env.local

# 3. 启动开发服务器
npm run dev
```

打开 http://localhost:3000 。

## 配置 Supabase

1. 前往 [supabase.com](https://supabase.com) 创建项目（免费档即可）。
2. 打开 **SQL Editor**，粘贴并执行 `supabase/migrations/0001_init.sql` 的完整内容（会创建 `profiles`、`game_scores` 表、索引、RLS 策略、注册触发器以及 `avatars` 存储桶）。
3. 在 **Project Settings → API** 中复制 `Project URL` 与 `anon public` key，填入环境变量。
4. （可选）如需关闭邮箱验证以便注册即登录：**Authentication → Providers → Email**，关闭「Confirm email」。

## 环境变量

复制 `.env.example` 为 `.env.local` 并填写：

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key（可公开） |
| `ANTI_CHEAT_SECRET` | 服务端防作弊签名密钥，任意长随机串 |
| `SUPABASE_SERVICE_ROLE_KEY`（可选） | 服务角色密钥，仅服务端使用，切勿公开 |

> `.env.local` 已在 `.gitignore` 中，不会被提交。`NEXT_PUBLIC_*` 前缀的变量会进入前端 bundle（anon key 本身设计为可公开），其余均为服务端私有。

## 安全设计

- **RLS（行级安全）**：`game_scores` 与 `profiles` 均开启 RLS——排行榜公开只读；用户只能写入 `user_id = auth.uid()` 的成绩、只能修改/删除自己的资料。
- **服务端防作弊**（`src/lib/anti-cheat.ts` + `src/app/api/scores/route.ts`）：
  1. 不信任客户端提交的 `score`，服务端根据 `made_shots` 重新计算；
  2. 开始游戏时由服务端签发带 HMAC 签名的令牌（含开始时间），提交时校验真实游戏时长（45–90 秒窗口）；
  3. 校验分数上限、投篮次数上限、`命中数 ≤ 投篮数`、难度枚举；
  4. 单用户 120 秒内最多提交 3 次，防刷分；
  5. `user_id` 一律取自服务端会话（`getUser()`），客户端无法冒充他人。
- 更彻底的防作弊（服务端重放整局投篮遥测）已在代码中预留扩展点，见 `src/lib/anti-cheat.ts` 注释。

## 部署到 Vercel

1. 将本项目推送到 GitHub 仓库。
2. 在 [vercel.com](https://vercel.com) 点击 **Add New → Project**，导入该仓库（框架会自动识别为 Next.js）。
3. 在 **Environment Variables** 中添加与 `.env.local` 相同的变量（`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`ANTI_CHEAT_SECRET`）。
4. 点击 **Deploy**。部署完成后即可通过 Vercel 提供的域名访问。

## 常用脚本

```bash
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run start    # 运行生产构建
npm run lint     # ESLint 检查
```
