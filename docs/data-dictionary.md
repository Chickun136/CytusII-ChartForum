# 数据字典（Sprint 4）

本文档记录谱面 JSON、曲目元数据与数据库字段的含义。数据管线对应 `scripts/import-charts.mjs`。

## 1. 数据来源与范围

| 数据 | 位置 | 说明 |
| --- | --- | --- |
| 谱面 JSON | 工作区 `Cytus II谱面数据/Cytus II 全谱面 5.3/` | 2223 个文件，约 234 MB，不进入公开仓库 |
| 曲目元数据 | `data/metadata/songs.json` | 695 首，由 ct2view 页头 + Cytus II Wiki 生成 |
| 曲目外号 | `data/metadata/aliases.json` | 人工维护的曲目 ID → 外号数组 |
| 本地数据库 | `prisma/dev.db`（SQLite） | 由 Prisma 生成，已在 `.gitignore` 中忽略 |
| 表结构 | `prisma/schema.prisma` | 迁移文件在 `prisma/migrations/` |

Sprint 1 默认导入前 30 首曲目及其全部难度（102 张谱面）；Sprint 4 已全量导入 695 首、2223 张谱面。

## 2. 文件名规则

```text
ai001_001_2.json
└─ 曲包     └─ 曲目    └─ 难度序号
```

- 曲目 ID：`ai001_001`
- 难度序号：`0` EASY、`1` HARD、`2` CHAOS、`3` GLITCH、`4` CRASH、`5` DREAM、`6` DROP
- 谱面 ID（`Chart.id`）：去掉 `.json` 的完整文件名，如 `ai001_001_2`

## 3. 谱面 JSON 顶层字段

| 字段 | 含义 |
| --- | --- |
| `format_version` | 谱面格式版本 |
| `time_base` | 每拍 tick 数，实测为 480 |
| `start_offset_time` | 谱面开始偏移（秒） |
| `page_list` | 分页（每页一屏） |
| `tempo_list` | 变速/节拍列表 |
| `event_order_list` | 演奏事件顺序，本项目暂未使用 |
| `note_list` | 音符列表 |

### 3.1 `page_list[]`

| 字段 | 含义 |
| --- | --- |
| `start_tick` | 本页起始 tick |
| `end_tick` | 本页结束 tick |
| `scan_line_direction` | `1` 从下往上扫，`-1` 从上往下扫 |

页长 `len = end_tick - start_tick`。每页扫描速度：

```text
BPM = 60,000,000 / tempo.value
SCANLINE = BPM × 960 / len
```

页长减半时 SCANLINE 翻倍，两者成反比。

### 3.2 `tempo_list[]`

| 字段 | 含义 |
| --- | --- |
| `tick` | 生效 tick |
| `value` | 每拍微秒数，`BPM = 60,000,000 / value` |

当前页速度与上一页不同即视为变速：加速画红色扫线/箭头，减速画绿色。

### 3.3 `note_list[]`

| 字段 | 含义 |
| --- | --- |
| `page_index` | 所属页序号 |
| `type` | 音符类型，见下表 |
| `id` | 音符唯一 ID |
| `tick` | 音符所在 tick |
| `x` | 横向坐标，`-1..1`；渲染为 `cx = 42 + 427 × x` |
| `has_sibling` | 是否有镜像/幽灵音符 |
| `hold_tick` | 长按结束 tick（长按类） |
| `next_id` | 锁链下一节点 ID |
| `is_forward` | 锁链方向标记 |

纵向渲染：`progress = (tick - start_tick) / len`，可玩区 `y=51..345`。

- `scan_line_direction = 1`：`y = 345 - progress × 294`
- `scan_line_direction = -1`：`y = 51 + progress × 294`

### 3.4 音符类型

| type | 含义 | 渲染 |
| --- | --- | --- |
| 0 | 点击 | 三层圆 |
| 1 | 长按 | 粗虚线 + 头部 |
| 2 | 跨屏长按 | 金色主体 + 白色导轨，按页分段 |
| 3 | 锁链头 | 大号紫色圆 |
| 4 | 锁链节点 | 小号紫色圆 + 虚线 |
| 5 | 闪烁（flick） | 菱形箭头 |
| 6 | c-drag（点锁） | 锁链形状 + click 配色 |
| 7 | c-drag（点锁） | 同上 |
| 8 / 9 | DREAM / DROP 专属 | 尚未实现；看谱区显示 `coming s∞n` 占位 |

链头判定：`type 3`，或没有任何其他链节点的 `next_id` 指向它。

## 4. 曲目元数据 `songs.json`

| 字段 | 含义 |
| --- | --- |
| `id` | 曲目 ID，如 `ai001_001` |
| `remoteId` | ct2view 中的 ID（个别曲包前缀不同，如 `graffj001`） |
| `title` | 曲名 |
| `artist` | 艺术家 |
| `character` | 曲目角色 |
| `bpm` | 基准 BPM |
| `scanline` | 扫描线速度范围文本 |
| `combo` | 最大 Combo（来自 ct2view） |
| `pageCount` | 页数（来自 ct2view） |
| `chaosLevel` | CHAOS 等级文本 |
| `wikiMatched` | 是否在 Wiki 中匹配到难度等级 |
| `charts` | 难度序号 → `{ difficulty, level, file }` |

## 5. 数据库表

### 5.1 `Song`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String @id | 曲目 ID |
| `title` | String | 曲名 |
| `artist` | String | 艺术家 |
| `character` | String? | 角色 |
| `category` | String? | 分类/曲包，暂未填充 |
| `bpm` | Int? | 基准 BPM |
| `coverUrl` | String? | 封面地址，如 `/covers/ai001_001.webp`；为空时列表显示占位块 |
| `metadataSource` | String? | 元数据来源 |
| `pinyinFull` | String? | 曲名全拼（小写、去符号），如 `aiaiai` |
| `pinyinInitials` | String? | 曲名拼音首字母，如 `bwfm`（Bullet Waiting for Me） |
| `orderIndex` | Int | 在 `songs.json` 中的顺序，默认排序依据 |
| `createdAt` | DateTime | 入库时间 |

`pinyinFull` / `pinyinInitials` 在导入时由 `pinyin-pro` 生成，均有索引，用于拼音搜索。

拼音首字母规则：按空白分词；纯 ASCII 词取首字母，中文段取拼音首字母，最终只保留 `[a-z0-9]`。

### 5.2 `Chart`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String @id | 谱面 ID（文件名去扩展名） |
| `songId` | String | 所属曲目 |
| `difficultyIndex` | Int | 0–6 |
| `difficultyName` | String | EASY / HARD / CHAOS / … |
| `difficultyLevel` | String? | 等级，CRASH 为 α/β/γ |
| `jsonFile` | String | 原始 JSON 文件名 |
| `pageCount` | Int | 页数 |
| `noteCount` | Int | 音符数 |
| `viewCount` | Int | 访问量，P1 使用 |
| `createdAt` | DateTime | 入库时间 |

唯一约束：`(songId, difficultyIndex)`。

### 5.3 `Alias`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | Int @id | 自增主键 |
| `songId` | String | 所属曲目 |
| `alias` | String | 外号/俗称 |
| `source` | String? | 来源 |
| `createdAt` | DateTime | 入库时间 |

唯一约束：`(songId, alias)`，同一首歌不会重复插入相同外号。

### 5.4 外号文件 `aliases.json`

`data/metadata/aliases.json` 由人工维护，导入脚本读取后写入 `Alias` 表：

```json
{
  "_meta": "曲目外号表：键为曲目 ID，值为外号数组，可按需扩充",
  "ai001_001": ["绊爱", "AI酱"]
}
```

- 以 `_` 开头的键会被忽略（用于存放说明）。
- 新增外号后重新执行导入命令即可同步（`upsert`，不会重复）。

### 5.5 `User` / `Session`（账号系统）

`User`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String @id | cuid |
| `email` | String @unique | 注册时统一转小写 |
| `passwordHash` | String | Node `scrypt`，格式 `salt:hash` |
| `nickname` | String | 2–20 个字符，默认取邮箱前缀 |
| `avatarUrl` | String? | `/api/avatars/<file>`；为空时显示首字母 |
| `capso` | Int | 默认 0，活动上线后按规则增加 |
| `role` | String | `MASTER` / `ADMIN` / `PLAYER` |
| `createdAt` / `updatedAt` | DateTime | 注册与更新时间 |

`Session`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | String @id | 会话 token 的 SHA-256，不存明文 |
| `userId` | String | 关联 `User`，级联删除 |
| `expiresAt` | DateTime | 30 天有效期 |
| `createdAt` | DateTime | 创建时间 |

- 第一个注册的账号自动成为 `MASTER`；Master 可在 `/admin` 将其他账号设为 `ADMIN` 或 `PLAYER`
- 会话 Cookie `cytus_session`：HttpOnly、SameSite=Lax，生产环境加 Secure
- 头像文件保存在 `data/avatars/`（`AVATAR_DIR` 可覆盖），单文件 ≤ 1 MB，仅接受 PNG/JPG/WebP

## 6. 数据管线命令

```powershell
npm run db:push                 # 同步 schema（开发时）
npm run db:import               # 默认导入前 30 首
node scripts/import-charts.mjs --all           # 导入全部 695 首
node scripts/import-charts.mjs --limit 50 --reset
npm run db:search -- AIAIAI     # 按歌名/艺术家/外号/拼音查询
```

## 7. 搜索字段与规则

`lib/songs.ts` 的 `searchSongs(query)` 会在以下字段做包含匹配：

| 字段 | 示例 |
| --- | --- |
| `title` | `AIAIAI` |
| `artist` | `Kizuna AI` |
| `character` | `PAFF` |
| `pinyinFull` | `aiai` |
| `pinyinInitials` | `bwfm` |
| `aliases.alias` | `绊爱` |

- 空查询返回前 24 首（按 `orderIndex` 排序）。
- 查询词会先做小写与去符号归一化，再参与匹配。
- 首页可按角色与难度区间筛选：URL 参数 `chars`（逗号分隔）、`min` / `max`（1–16）。
- 难度筛选按谱面等级判断，`13+` / `15＋` 按 13.5 / 15.5 计算；未填等级的谱面不参与区间匹配。
- 排序参数 `sort`：缺省按 `orderIndex`；`difficulty-desc` / `difficulty-asc` 按每首歌的最高难度排序。
- 分页参数 `page`：手机（UA 含 Mobile/Android/iPhone）每页 10 张，其余每页 40 张。

## 8. 已知限制

- Wiki 难度匹配 680/695，剩余 15 首等级为 `null`。
- `category`、`coverUrl` 暂未填充。
- DREAM / DROP 的 `type 8/9` 尚未实现；对应难度显示 `coming s∞n` 占位，待映射逻辑确认后补齐。
- 账号系统未接入邮箱验证码与登录限流；活动模块未开发，Capso 暂无增长途径。
- 原始谱面 JSON 与 SQLite 数据库均不提交公开仓库。
