# 部署指南（自建服务器）

- 目标：Ubuntu 22.04/24.04 + Node.js + Nginx + PM2，SQLite 与谱面 JSON 放在服务器数据目录
- 状态：**待执行**。服务器与域名尚未购买；本文是上线前的操作清单，拿到服务器后按步骤执行即可

## 1. 资源估算

| 项 | 大小 / 要求 | 说明 |
| --- | --- | --- |
| 谱面 JSON | 约 234 MB | 2223 个文件，放在数据目录，不进入 Git |
| SQLite 数据库 | 约 0.6 MB | 只存曲目/谱面元数据，不含谱面内容 |
| SVG 缓存 | 约 1.1 GB（全量预热后） | 可随时删除重建，按需生成 |
| 服务器 | 2 核 4 GB 起，磁盘 ≥ 10 GB | 单机即可，无需 Docker |
| 软件 | Node.js 22+、npm、Git、Nginx、PM2、Certbot | Node 20.9+ 即可运行 Next 16 |

## 2. 目录规划

```text
/srv/cytus/
├─ app/                 # 仓库代码
├─ data/
│  ├─ charts/           # Cytus II 全谱面 5.3 的 JSON
│  ├─ cache/            # 渲染缓存（可删除）
│  └─ dev.db            # SQLite（从开发机复制，或在服务器重新导入）
```

> 谱面 JSON、数据库、缓存都不要放进 `public/` 或仓库；Web 只能通过应用接口访问。

## 3. 首次部署

### 3.1 系统与依赖

```bash
sudo apt update
sudo apt install -y git nginx sqlite3
# Node.js 22 LTS（NodeSource）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

### 3.2 拉取代码与安装依赖

```bash
sudo mkdir -p /srv/cytus && sudo chown -R $USER:$USER /srv/cytus
cd /srv/cytus
git clone https://github.com/Chickun136/CytusII-ChartForum.git app
cd app
npm ci
```

### 3.3 环境变量

创建 `/srv/cytus/app/.env`：

```dotenv
DATABASE_URL="file:/srv/cytus/data/dev.db"
CHART_DATA_DIR="/srv/cytus/data/charts"
CHART_CACHE_DIR="/srv/cytus/data/cache"
PORT=3000
```

### 3.4 数据准备（二选一）

**A. 复制开发机数据库（快）**

```bash
# 在开发机执行
scp prisma/dev.db user@server:/srv/cytus/data/dev.db
# 在服务器执行
cd /srv/cytus/app
npx prisma migrate deploy
npx prisma generate
```

**B. 服务器重新导入（可复现）**

```bash
cd /srv/cytus/app
npx prisma migrate deploy
npx prisma generate
# 先把谱面 JSON 上传到 /srv/cytus/data/charts
node scripts/import-charts.mjs --all --data-dir /srv/cytus/data/charts
```

外号表随仓库的 `data/metadata/aliases.json` 一起导入。

### 3.5 构建与启动

```bash
cd /srv/cytus/app
npm run build
pm2 start npm --name cytus-chart -- run start
pm2 save
pm2 startup   # 按提示执行输出的命令
```

确认本机可访问：

```bash
curl -I http://127.0.0.1:3000/
curl 'http://127.0.0.1:3000/api/search?q=bwfm'
```

### 3.6 Nginx 反向代理

`/etc/nginx/sites-available/cytus`：

```nginx
server {
    listen 80;
    server_name chart.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cytus /etc/nginx/sites-enabled/cytus
sudo nginx -t && sudo systemctl reload nginx
sudo ufw allow 80,443/tcp
```

### 3.7 HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d chart.example.com
```

## 4. 上线验收

| 项 | 命令 / 操作 | 预期 |
| --- | --- | --- |
| 首页 | `curl -I https://chart.example.com/` | 200 |
| 搜索 | `curl 'https://chart.example.com/api/search?q=bwfm'` | `count=1`，首条 Bullet Waiting for Me |
| 谱面 | `curl -I https://chart.example.com/api/charts/paff001_002_2/0` | 200，`image/svg+xml`，`X-Chart-Cache: HIT/MISS` |
| 协商缓存 | 带 `If-None-Match` 再请求 | 304 |
| 详情 | 浏览器打开 `/songs/paff001_002` | 难度、翻页、整谱下载正常 |
| 移动端 | 手机访问 | 单列、每页 10 张、无横向滚动 |

## 5. 更新与回滚

```bash
cd /srv/cytus/app
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart cytus-chart
```

- 回滚：`git checkout <上一个 commit>` → `npm ci` → `npm run build` → `pm2 restart cytus-chart`
- 数据库备份：`sqlite3 /srv/cytus/data/dev.db ".backup '/srv/cytus/backup/dev-$(date +%F).db'"`
- 缓存可随时删除：`rm -rf /srv/cytus/data/cache/*`，首次访问会重新生成

## 6. 运维注意

1. 不要对公网开放 3000 端口，只保留 Nginx 的 80/443。
2. `data/` 目录需对运行 PM2 的用户可读写。
3. 谱面 JSON 与数据库不进 Git；备份只需数据库，缓存可重建。
4. 页面已注明版权归雷亚（Rayark）所有，仅课程学习演示；如收到投诉，先下线并移除数据。
5. 若以后改用对象存储/CDN 托管谱面 JSON 或曲绘，`CHART_DATA_DIR` 需改为下载/缓存目录，或在 `chart-service` 中增加远程读取逻辑。

## 7. 待办

- [ ] 购买服务器与域名，确定系统版本
- [ ] 上传 `data/charts` 与数据库（或服务器重新导入）
- [ ] 配置 Nginx + HTTPS，完成第 4 节验收
- [ ] 把线上地址回填到 `README.md` 与 `计划.md`
