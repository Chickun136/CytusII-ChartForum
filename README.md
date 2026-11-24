# Cytus II Chart Forum

Cytus II 谱面查询与交流站。支持歌名/外号/拼音搜索、角色与难度筛选、排序分页、谱面查看与整谱 PNG 导出，并提供账号系统（注册/登录、头像昵称、Master/Admin/Player）。

## 技术栈

- Next.js 16（App Router）+ TypeScript
- Tailwind CSS 4
- 数据脚本：纯 Node ESM（`scripts/`）

## 本地开发

```powershell
npm install
npm run dev
```

打开 http://localhost:3000 。

生产构建：

```powershell
npm run build
npm start
```

## 数据与渲染脚本

谱面原始 JSON 不放入仓库，默认位于工作区的 `Cytus II谱面数据/Cytus II 全谱面 5.3/`。

```powershell
# 单张谱面 → 每页 SVG + 预览画廊（输出到 .preview/）
node scripts/render-preview.mjs "..\Cytus II谱面数据\Cytus II 全谱面 5.3\ai001_001_2.json"

# 批量校验 GLITCH / CRASH 复杂谱面
node scripts/validate-charts.mjs "..\Cytus II谱面数据\Cytus II 全谱面 5.3\cherry002_005_3.json"

# 重新抓取曲目元数据（需联网）
node --use-system-ca scripts/fetch-metadata.mjs
```

曲目索引：`data/metadata/songs.json`（695 首，含难度与等级）。

## 数据库（Sprint 1）

项目使用 Prisma + SQLite。首次运行：

```powershell
# 在仓库根目录创建 .env（内容同 .env.example）：
# DATABASE_URL="file:./dev.db"

npm run db:push        # 建表（或 npx prisma migrate dev）
npm run db:import      # 默认导入前 30 首曲目
npm run db:search -- AIAIAI
```

- 导入全部曲目：`node scripts/import-charts.mjs --all`（695 首 / 2223 张谱面）
- 清空后重新导入：`npm run db:import -- --reset`
- 表结构与字段含义见 [docs/data-dictionary.md](docs/data-dictionary.md)

## 查询页（Sprint 4）

```text
GET /                      首页搜索（?q= 歌名 / 外号 / 拼音）
GET /songs/<songId>        曲目详情（难度切换、翻页、全屏）
GET /api/search?q=         搜索 JSON 接口
```

- 搜索覆盖曲名、艺术家、角色、拼音全拼、拼音首字母与外号，例如 `AIAIAI`、`bwfm`、`绊爱`、`Kizuna`。
- 角色胶囊与 1–16 难度区间可先调整，点击「搜索」后统一下发；条件写入 URL（`q` / `chars` / `min` / `max` / `sort`），分页用 `page`。
- 难度筛选按最高难度排序时只考虑每首歌的最高等级，`13+` / `15＋` 按 13.5 / 15.5 计算；默认按 `songs.json` 顺序。
- 列表分页：手机 10 张/页，桌面 40 张/页（两列），支持上一页、下一页与跳页。
- 外号维护在 `data/metadata/aliases.json`，导入时同步到 `Alias` 表。
- 详情页默认选中 CHAOS，支持全屏、键盘左右键翻页，可导出整谱 PNG。
- DREAM / DROP 暂未实现 type 8/9 映射，看谱区显示一屏空扫描线与 `coming s∞n` 占位，不提供翻页与下载。

## 封面资源

曲绘放入 `public/covers/<songId>.webp`，再把 `Song.coverUrl` 填成 `/covers/<songId>.webp` 即可显示；未填写时卡片显示占位块。上线后可改为对象存储或 CDN 的绝对 URL。

## 账号系统

- 顶部菜单：谱面列表 / 个人账号 / 活动（开发中）；Master / Admin 额外显示「管理」
- 注册需要邮箱、密码与确认密码；**第一个注册的账号自动成为 Master（内部账号）**，之后注册为 Player
- 角色：Master（分配管理员、管理活动）、Admin（管理后台 / 活动）、Player（普通玩家）
- 个人账号支持修改昵称、上传头像（PNG / JPG / WebP，≤1 MB）；Capso 默认 0，活动上线后按活动规则增加
- 会话使用 HttpOnly Cookie（30 天），密码用 Node `scrypt` 哈希；头像存 `data/avatars`，可用 `AVATAR_DIR` 覆盖，部署时需持久化该目录
- 暂未接入邮箱验证码与登录限流，仅做课程演示用途

## 评论区与消息中心

- 曲目详情页支持登录后发表评论、回复（一级）与点赞；未登录时显示「去登录」。
- 点赞会自动通知评论作者；回复会自动通知被回复评论的作者，自己的操作不产生通知。
- 账号页右上角信封图标即消息入口：有未读时显示红点，点击后高亮并在下方展开完整消息板块；打开后自动标记已读。
- 消息板块与个人资料互斥：选中消息时隐藏昵称/头像设置，只显示消息列表；玩家信息与 Capso 提示固定在顶部卡片内。
- 消息分为「赞」与「回复」两类；同一评论的多条点赞/回复只保留一行，显示为「某某 等 N 人」。
- 数据表为 `Comment` / `CommentLike` / `Notification`，迁移见 `prisma/migrations/20261124120000_add_comments_and_notifications`。

## 谱面渲染 API 与缓存（Sprint 3）

```text
GET /api/charts/<chartId>/<page>
```

- `chartId` 为去掉 `.json` 的文件名，如 `ai001_001_2`
- 返回 `image/svg+xml`，带 ETag，支持 304
- 首次渲染写入 `.cache/charts/`，命中缓存时响应头 `X-Chart-Cache: HIT`

相关命令：

```powershell
npm run render:coverage              # 全量谱面抽样渲染校验
node scripts/render-coverage.mjs --all-pages
npm run render:bench -- ai001_001_2 0
```

环境变量：`CHART_DATA_DIR`（谱面目录）、`CHART_CACHE_DIR`（缓存目录）。
核对结果见 [docs/render-coverage.md](docs/render-coverage.md)。

## 部署

自建服务器（Ubuntu + Nginx + PM2 + SQLite/谱面目录挂载）的完整步骤见 [docs/deployment.md](docs/deployment.md)。当前尚未购买服务器与域名，线上地址待补。

## 项目结构

```text
CytusII-ChartForum/
├─ app/                         路由与页面（Next.js App Router）
│  ├─ layout.tsx                根布局、字体、全局样式
│  ├─ page.tsx                  首页：搜索 + 角色/难度筛选 + 排序 + 分页
│  ├─ globals.css               Tailwind 与主题样式
│  ├─ songs/[id]/page.tsx       曲目详情：元数据 + 看谱
│  ├─ account/
│  │  ├─ page.tsx               登录 / 注册 / 个人资料
│  │  └─ actions.ts             账号相关 Server Actions
│  ├─ admin/page.tsx            账号管理（Master / Admin）
│  ├─ events/page.tsx           活动占位页
│  └─ api/
│     ├─ search/route.ts        搜索 JSON API
│     ├─ charts/[chartId]/[page]/route.ts   单页 SVG 输出
│     └─ avatars/[file]/route.ts            头像文件读取
│
├─ components/                  UI 组件
│  ├─ site-header.tsx           顶栏、登录状态
│  ├─ site-nav.tsx              菜单与当前页高亮
│  ├─ search-controls.tsx       搜索框、角色胶囊、难度滑杆、排序
│  ├─ song-card.tsx             结果卡片（1:1 曲绘占位）
│  ├─ pagination.tsx            上一页 / 下一页 / 跳页
│  ├─ chart-viewer.tsx          看谱、翻页、整谱 PNG 导出、评分
│  ├─ comment-section.tsx       评论列表、点赞、回复
│  ├─ comment-form.tsx          评论 / 回复输入框
│  ├─ reply-box.tsx             回复展开与收起
│  ├─ message-link.tsx          消息入口与未读红点
│  ├─ message-section.tsx       账号页消息板块、赞 / 回复标签
│  ├─ difficulty-badge.tsx      难度徽标
│  ├─ auth-forms.tsx            登录 / 注册表单
│  └─ profile-settings.tsx      昵称、头像、密码
│
├─ lib/                         业务逻辑
│  ├─ prisma.ts                 PrismaClient 单例
│  ├─ songs.ts                  搜索 / 筛选 / 排序 / 分页 / 详情查询
│  ├─ difficulty.ts             难度配色、等级解析（+ 按 .5）
│  ├─ chart-service.mjs         渲染器接入、SVG 缓存、ETag
│  ├─ comments.ts               评论与回复查询
│  ├─ notifications.ts          点赞 / 回复消息查询
│  ├─ time.ts                   相对时间格式化
│  ├─ auth.ts / auth-types.ts   会话与当前用户
│  ├─ roles.ts                  角色与权限判断
│  └─ avatar.ts                 头像校验与保存
│
├─ scripts/                     离线数据与维护脚本
│  ├─ fetch-metadata.mjs        抓取曲目元数据
│  ├─ import-charts.mjs         谱面入库（拼音 / 别名 / 排序）
│  ├─ validate-charts.mjs       谱面数据校验
│  ├─ render-preview.mjs        单谱 SVG 渲染原型
│  ├─ render-coverage.mjs       全量渲染覆盖报告
│  ├─ bench-cache.mjs           缓存性能测试
│  └─ search-songs.mjs          CLI 搜索验证
│
├─ prisma/
│  ├─ schema.prisma             Song / Chart / Alias / User / Session
│  ├─ migrations/               数据库迁移
│  └─ dev.db                    SQLite 数据库（未提交）
│
├─ data/
│  ├─ metadata/songs.json       695 首曲目元数据
│  ├─ metadata/aliases.json     外号表（可手动编辑）
│  ├─ reports/render-coverage.json  渲染覆盖报告
│  └─ avatars/                  用户头像（运行时生成，未提交）
│
├─ docs/
│  ├─ data-dictionary.md        数据字典
│  └─ render-coverage.md        渲染覆盖说明
│
└─ 根配置
   ├─ next.config.ts / tsconfig.json / eslint.config.mjs
   ├─ package.json / package-lock.json
   ├─ .env.example              DATABASE_URL、AVATAR_DIR 示例
   └─ README.md
```

运行时生成、不提交的目录：

```text
.next/          Next.js 构建产物
.cache/charts/  谱面 SVG 缓存
.preview/       渲染样张与元数据抓取缓存
node_modules/   依赖
```

原始谱面 JSON 位于仓库外：`../Cytus II谱面数据/Cytus II 全谱面 5.3/`。

主要调用链：

- 首页：`app/page.tsx` → `lib/songs.ts` → Prisma
- 详情：`app/songs/[id]/page.tsx` → `components/chart-viewer.tsx`
- 谱面图：`chart-viewer` → `/api/charts/...` → `lib/chart-service.mjs` → 渲染器 + 缓存
- 账号：`app/account/page.tsx` → `app/account/actions.ts` → `lib/auth.ts` → `User` / `Session`
- 数据准备：`scripts/` → `data/metadata` + 原始 JSON → `prisma/dev.db`

## 版权

Cytus II 曲目与谱面版权归雷亚（Rayark）所有。本项目仅用于课程学习与演示，不提供音频下载。
