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

### 局域网访问时按钮无响应（开发模式）

用局域网 IP（如 `http://172.22.96.15:3000`）在手机或另一台设备上打开开发服务器时，页面和谱面图能正常显示，但翻页、评分、评论、难度切换等按钮全部没有反应。

**原因**：Next.js 16 开发服务器默认阻止跨来源访问 `/_next/*` 开发资源。HTML 可以正常服务端渲染，但客户端 JS 没有完成 hydration；浏览器控制台通常没有明显报错，服务端日志会出现：

```text
Blocked cross-origin request to Next.js dev resource /_next/hmr from "172.22.96.15"
```

**解决**：把访问时使用的 IP 加入 `next.config.ts` 的 `allowedDevOrigins`，然后重启 `npm run dev`：

```ts
const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.22.96.15"],
  // ...
};
```

- IP 变化后需要同步修改这里的值
- 该配置只在 `npm run dev` 生效；`npm run build && npm start` 生产模式没有此限制
- 在本机开发时直接访问 `http://localhost:3000` 不会触发该问题

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
- `--reset` 仅用于本地重建数据：会清空歌曲/谱面/词条，并级联删除评论，线上禁止使用
- 表结构与字段含义见 [docs/data-dictionary.md](docs/data-dictionary.md)
- 曲目、谱面与词条的完整维护流程见下文「曲目 / 谱面 / 词条维护流程（手动）」

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

曲绘源目录为工作区的 `Cytus II谱面数据/Cytus II 全曲绘 5.3/`，按角色分文件夹，其中 `square/` 为 1:1 正方形曲绘。导入命令：

```powershell
npm run db:covers
# 或
node scripts/import-covers.mjs
```

- 匹配规则：文件名 `<songId>.png` 对应 `Song.id`；同名文件优先使用 `square/`，其次角色文件夹。
- 处理：用 `sharp` 居中裁成正方形、最长边不超过 512，输出 WebP（质量 82）到 `public/covers/<songId>.webp`，并写入 `Song.coverUrl`。
- 可选参数：`--source <目录>`、`--out <目录>`、`--force`（强制重转）、`--dry-run`（只统计不写文件）；也可用 `COVER_SOURCE_DIR` / `COVER_OUTPUT_DIR` 指定目录。
- 幂等：输出文件比源文件新时直接复用；重复执行不会重复转换。
- 695 张曲绘约 22 MB；未安装 `sharp` 时脚本会回退为复制原图，体积明显更大。
- 上线后可把 `coverUrl` 改为对象存储或 CDN 的绝对 URL，前端无需改动。

## 曲目 / 谱面 / 词条维护流程（手动）

可视化维护模块暂未开发。当前唯一可靠的维护方式是：**修改元数据 → 重新执行导入 → 在页面验证**。网站运行时只读 SQLite，单独修改 `songs.json` / `aliases.json` 不会生效。

### 0. 前提与命令

- 谱面目录：本地默认 `../Cytus II谱面数据/Cytus II 全谱面 5.3/`；线上由 `CHART_DATA_DIR` 指定。导入脚本默认走上面的本地相对路径，**线上必须用 `--data-dir` 显式传入服务器目录**，并保证它与 `CHART_DATA_DIR` 指向同一个位置。
- 元数据：曲目 `data/metadata/songs.json`，外号 `data/metadata/aliases.json`。
- 导入命令：

```powershell
# 全量导入（新增的曲目一般排在数组末尾，必须用 --all 才会覆盖到）
node scripts/import-charts.mjs --all

# 线上 / 自定义谱面目录
node scripts/import-charts.mjs --all --data-dir "D:\cytus\charts"
```

- 默认不带 `--all` 时只导入 `songs.json` 前 30 首（且只为这 30 首同步外号），新增曲目很容易漏掉。
- **禁止使用 `--reset`**：它会清空 `songs / charts / aliases`，并通过外键级联删除这些歌曲下的评论。仅本地重建数据时可用。
- 导入是 `upsert`：只新增/更新，不会删除数据库中已有的曲目、谱面或词条。

### 1. 新增一首曲目

1. 准备谱面 JSON，命名规则 `<songId>_<难度序号>.json`，例如 `alice001_001_2.json`。难度序号：`0 EASY / 1 HARD / 2 CHAOS / 3 GLITCH / 4 CRASH / 5 DREAM / 6 DROP`。
2. 把 JSON 放进谱面目录（本地或服务器的 `CHART_DATA_DIR`）。
3. 在 `songs.json` 的 `songs` 数组末尾追加条目（`orderIndex` 由数组位置自动决定，追加即排在最后）：

```json
{
  "id": "alice001_001",
  "title": "曲名",
  "artist": "艺术家",
  "character": "角色",
  "bpm": 160,
  "charts": {
    "0": { "difficulty": "EASY", "level": "4", "file": "alice001_001_0.json" },
    "2": { "difficulty": "CHAOS", "level": "12", "file": "alice001_001_2.json" }
  }
}
```

- `charts` 只登记实际存在的难度；后补 GLITCH / CRASH 时新增 `"3"` / `"4"` 条目并上传对应 JSON 即可，不需要重建曲目。
- `level` 用字符串（CRASH 可写 `α` / `β` / `γ`）；`file` 必须与磁盘上的文件名完全一致，且等于 `<id>_<难度序号>.json`。
- 至少要有 1 个难度条目，否则导入脚本会跳过该曲目。
- 拼音字段（`pinyinFull` / `pinyinInitials`）由导入脚本根据 `title` 自动生成，不要手写。
- 词条与谱面 JSON 都不放进元数据文件；谱面 JSON 本身不提交仓库。

4. 需要外号时，在 `aliases.json` 增加：

```json
{
  "alice001_001": ["外号一", "外号二"]
}
```

5. 重新导入：

```powershell
node scripts/import-charts.mjs --all
```

检查输出：`skipped` 列表应为空；若有「文件不存在」或「解析失败」，按提示修正后重跑。

6. 验证：首页搜索曲名/外号/拼音首字母 → 进入详情页 → 切换难度 → 页数与音符数是否正常。

7. 曲绘（可选）：图片转成 512×512 WebP，放到 `public/covers/<songId>.webp`，再把数据库 `Song.coverUrl` 设为 `/covers/<songId>.webp`。目前没有自动写入 `coverUrl` 的脚本，可用 `npx prisma studio` 手动修改，或等后续 `import-covers` 脚本。

8. 提交改动：`songs.json` / `aliases.json` 提交到 git；谱面 JSON 与曲绘按现有约定不提交。

### 2. 修改曲目信息

- 直接编辑 `songs.json` 对应字段（`title` / `artist` / `character` / `bpm` / `charts`），然后重跑 `--all` 导入。
- 调整展示顺序：移动该条目在 `songs` 数组中的位置即可，导入时按数组下标写入 `orderIndex`；不要手写 `orderIndex` 字段。
- 修改 `title` 后拼音会自动重算，搜索关键词随之变化。

### 3. 维护查询词条（别名）

- **新增**：在 `aliases.json` 对应曲目的数组中加词 → 重跑导入（`upsert` 自动去重）。
- **删除**：从 JSON 中删掉不会删除数据库记录，因为导入只做 `upsert`。需要打开 `npx prisma studio`，在 `Alias` 表删除对应行；或直接用 SQLite 执行 `DELETE FROM Alias WHERE songId = '...' AND alias = '...'`。
- **修改**：等价于删除旧词条 + 新增新词条。
- 词条改动写入数据库后立即生效，不需要重启服务。

### 4. 删除曲目或单个难度

仅在信息录入错误时删除，当前**不保留备份**，操作前先确认。

- 删除单个难度：Prisma Studio 删除 `Chart` 表中对应行，再删除谱面目录里的 JSON 文件；`.cache/charts/<chartId>/` 缓存目录可一并删除。
- 删除整首曲目：Prisma Studio 删除 `Song` 表对应行 → 级联删除 `Chart`、`Alias` 和该曲目下的 `Comment`；再手动删除谱面 JSON 与 `public/covers/<songId>.webp`。
- 删除后无需重启：首页列表、搜索与详情页立即不再返回该曲目。
- 删除完成后建议再跑一次 `--all` 前检查 `songs.json` 里是否还留有该条目，避免下次导入被重新写回。

### 5. 替换 / 覆盖谱面

- 用新 JSON 覆盖同名文件 → 重跑导入（`pageCount` / `noteCount` 会更新）→ 页面缓存按文件 mtime 自动失效。
- 若仍显示旧图，删除 `.cache/charts/<chartId>/` 后刷新页面。

### 6. 常见问题

| 现象 | 排查方向 |
| --- | --- |
| 导入输出 `skipped` | 文件名与 `charts.file` 不一致、路径不是 `--data-dir` 指向的目录、JSON 解析失败 |
| 首页搜不到新曲目 | 是否用了 `--all`、`title` 是否为空、导入是否报错 |
| 详情页 404 | `Chart` 未入库，或 `difficultyIndex` 与文件名末尾序号不一致 |
| 页面显示旧谱面 | 删除 `.cache/charts/<chartId>/` 后重试 |
| 线上改了没效果 | 线上数据库与服务器文件不是同一份；确认 `--data-dir` 与 `CHART_DATA_DIR` 一致 |
| 误用了 `--reset` | 歌曲/谱面/词条与评论已被清空，只能从 `songs.json` 重新导入并手动恢复评论（无法自动找回） |

### 7. 上线后的操作方式

1. 通过 SCP / SFTP 把谱面 JSON 上传到服务器 `CHART_DATA_DIR`。
2. 在服务器上编辑 `songs.json` / `aliases.json`（推荐本地改完后提交 git，再在服务器 `git pull`，避免两边不一致）。
3. 执行 `node scripts/import-charts.mjs --all --data-dir <服务器谱面目录>`。
4. 打开站点验证搜索与详情页。
5. 改动前先备份 `prisma/dev.db`（SQLite 文件），出问题可直接回滚。


## 账号系统

- 顶部菜单：谱面列表 / 个人账号 / 活动；Master / Admin 额外显示「管理」
- 注册需要邮箱、密码与确认密码；**第一个注册的账号自动成为 Master（内部账号）**，之后注册为 Player
- 角色：Master（分配管理员、处理全部举报、管理活动）、Admin（处理 Player 举报、管理活动、查看玩家列表）、Player（普通玩家）
- 个人账号支持修改昵称、上传头像（PNG / JPG / WebP，≤1 MB）；Capso 默认 0，活动上线后按活动规则增加
- 会话使用 HttpOnly Cookie（30 天），密码用 Node `scrypt` 哈希；头像存 `data/avatars`，可用 `AVATAR_DIR` 覆盖，部署时需持久化该目录
- 暂未接入邮箱验证码与登录限流，仅做课程演示用途

## 评论区与消息中心

- 曲目详情页支持登录后发表评论、回复（一级）与点赞；未登录时显示「去登录」。
- 点赞会自动通知评论作者；回复会自动通知被回复评论的作者，自己的操作不产生通知。
- 账号页右上角信封图标即消息入口：有未读时显示红点，点击后高亮并在下方展开完整消息板块；打开后自动标记已读。
- 消息板块与个人资料互斥：选中消息时隐藏昵称/头像设置，只显示消息列表；玩家信息与 Capso 提示固定在顶部卡片内。
- 消息分为「赞 / 回复 / 处理」三类；同一评论的多条点赞/回复只保留一行，显示为「某某 等 N 人」。
- 数据表为 `Comment` / `CommentLike` / `Notification`，迁移见 `prisma/migrations/20261124120000_add_comments_and_notifications`。

## 评论治理（举报 / 删除 / 禁言）

- 每条评论的操作行附带「举报」，必须填写文字说明；被举报评论在审核期间**保持可见**。
- 删除采用软删除：本人删除显示「该评论已被删除」，违规处理显示「该评论已被管理员删除」；一级评论删除后其回复一并隐藏。
- 权限：Player 可删除自己的评论并举报他人；Admin 可删除 Player 的评论、处理 Player 的举报；Master 可处理全部（含 Admin）。Admin 可查看涉及 Admin 的举报，但只有 Master 能处理。
- 举报队列全站共享，按评论聚合展示；处理动作包括忽略、删除、删除并禁言 1 / 3 / 7 天。禁言只能随举报处理发起，不设独立入口。
- 禁言期间无法发表评论与回复，提示「您已被限制评论功能，X 后方可正常发布评论」；歌曲与评论点赞不受限制。
- 通知：举报人收到处理结果；评论作者仅在判定违规时收到处理通知。账号页「我的举报」（`/account?view=reports`）只展示本人提交的记录与结果。
- 相关代码：`lib/moderation.ts`、`lib/permissions.ts`、`app/songs/[id]/report-actions.ts`、`app/admin/report-actions.ts`；迁移见 `prisma/migrations/20261124160342_add_moderation_and_events`。

## 管理后台

`/admin` 仅 Master / Admin 可访问，包含三个 tab：

- **活动**：Admin 与 Master 均可创建、编辑、发布与撤回活动；`/events` 只展示已发布活动。
- **举报队列**：按评论聚合的待处理举报、举报说明与处理表单；涉及 Admin 的举报对 Admin 只读。
- **用户**：Admin 查看 Player 列表；Master 可额外切换 Admin 列表，并分配 Admin / Player 角色。

活动数据表为 `Event`，举报与禁言字段在 `Report` 表中。

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
│  ├─ songs/[id]/
│  │  ├─ page.tsx               曲目详情：元数据 + 看谱
│  │  ├─ comment-actions.ts     评论 / 回复 / 删除 / 点赞 Actions
│  │  └─ report-actions.ts      提交举报
│  ├─ account/
│  │  ├─ page.tsx               登录 / 注册 / 个人资料 / 消息 / 我的举报
│  │  └─ actions.ts             账号相关 Server Actions
│  ├─ admin/
│  │  ├─ page.tsx               管理后台：活动 / 举报队列 / 用户
│  │  ├─ report-actions.ts      举报处理与禁言
│  │  └─ event-actions.ts       活动创建、编辑、发布与撤回
│  ├─ events/page.tsx           已发布活动列表
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
│  ├─ comment-section.tsx       评论列表、点赞、回复、举报入口、禁言提示
│  ├─ comment-form.tsx          评论 / 回复输入框
│  ├─ reply-box.tsx             回复展开与收起
│  ├─ report-form.tsx           举报说明表单
│  ├─ delete-comment-button.tsx 删除评论确认按钮
│  ├─ report-section.tsx        账号页「我的举报」
│  ├─ message-link.tsx          消息入口与未读红点
│  ├─ message-section.tsx       账号页消息板块、赞 / 回复 / 处理标签
│  ├─ difficulty-badge.tsx      难度徽标
│  ├─ auth-forms.tsx            登录 / 注册表单
│  └─ profile-settings.tsx      昵称、头像、密码
│
├─ lib/                         业务逻辑
│  ├─ prisma.ts                 PrismaClient 单例
│  ├─ songs.ts                  搜索 / 筛选 / 排序 / 分页 / 详情查询
│  ├─ difficulty.ts             难度配色、等级解析（+ 按 .5）
│  ├─ chart-service.mjs         渲染器接入、SVG 缓存、ETag
│  ├─ comments.ts               评论与回复查询（含软删除）
│  ├─ notifications.ts          点赞 / 回复 / 处理结果消息查询
│  ├─ moderation.ts             举报队列、我的举报、禁言查询
│  ├─ permissions.ts            评论删除与举报处理权限
│  ├─ time.ts                   相对时间与日期格式化
│  ├─ auth.ts / auth-types.ts   会话与当前用户
│  ├─ roles.ts                  角色与权限判断
│  └─ avatar.ts                 头像校验与保存
│
├─ scripts/                     离线数据与维护脚本
│  ├─ fetch-metadata.mjs        抓取曲目元数据
│  ├─ import-charts.mjs         谱面入库（拼音 / 别名 / 排序）
│  ├─ import-covers.mjs         曲绘转 WebP 并写入 coverUrl
│  ├─ validate-charts.mjs       谱面数据校验
│  ├─ render-preview.mjs        单谱 SVG 渲染原型
│  ├─ render-coverage.mjs       全量渲染覆盖报告
│  ├─ bench-cache.mjs           缓存性能测试
│  └─ search-songs.mjs          CLI 搜索验证
│
├─ prisma/
│  ├─ schema.prisma             Song / Chart / Alias / User / Comment / Report / Event
│  ├─ migrations/               数据库迁移
│  └─ dev.db                    SQLite 数据库（未提交）
│
├─ public/
│  └─ covers/                   曲绘 WebP（由 import-covers 生成）
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
- 评论治理：`comment-section` → `report-actions` / `comment-actions` → `lib/permissions.ts` / `lib/moderation.ts` → `Report`
- 管理后台：`app/admin/page.tsx` → `report-actions` / `event-actions` → `Report` / `Event`
- 数据准备：`scripts/` → `data/metadata` + 原始 JSON → `prisma/dev.db`

## 版权

Cytus II 曲目与谱面版权归雷亚（Rayark）所有。本项目仅用于课程学习与演示，不提供音频下载。
