# Cytus II Chart Forum

Cytus II 谱面查询与交流站。当前为 Sprint 0：Next.js 骨架已初始化，可运行空白站点。

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

- 导入全部曲目：`node scripts/import-charts.mjs --all`
- 清空后重新导入：`npm run db:import -- --reset`
- 表结构与字段含义见 [docs/data-dictionary.md](docs/data-dictionary.md)

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
