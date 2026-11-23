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

## 封面资源

曲绘放入 `public/covers/<songId>.webp`，再把 `Song.coverUrl` 填成 `/covers/<songId>.webp` 即可显示；未填写时卡片显示占位块。上线后可改为对象存储或 CDN 的绝对 URL。

## 账号系统

- 顶部菜单：谱面列表 / 个人账号 / 活动（开发中）；Master / Admin 额外显示「管理」
- 注册需要邮箱、密码与确认密码；**第一个注册的账号自动成为 Master（内部账号）**，之后注册为 Player
- 角色：Master（分配管理员、管理活动）、Admin（管理后台 / 活动）、Player（普通玩家）
- 个人账号支持修改昵称、上传头像（PNG / JPG / WebP，≤1 MB）；Capso 默认 0，活动上线后按活动规则增加
- 会话使用 HttpOnly Cookie（30 天），密码用 Node `scrypt` 哈希；头像存 `data/avatars`，可用 `AVATAR_DIR` 覆盖，部署时需持久化该目录
- 暂未接入邮箱验证码与登录限流，仅做课程演示用途

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

## 目录

```text
app/            页面与布局
docs/           需求、设计、测试、验收文档
scripts/        数据抓取、谱面渲染与校验
data/metadata/  曲目元数据索引
```

## 版权

Cytus II 曲目与谱面版权归雷亚（Rayark）所有。本项目仅用于课程学习与演示，不提供音频下载。
