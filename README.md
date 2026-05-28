# NavDev

一个现代化的导航站点管理平台，基于 Next.js 15 和 Cloudflare 全栈构建。

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages-orange?logo=cloudflare)
![License](https://img.shields.io/badge/License-MIT-green)

## 特性

- **现代技术栈** - Next.js 15 + React 18 + TypeScript + Tailwind CSS
- **边缘运行时** - 基于 Cloudflare Pages Edge Runtime，全球加速
- **云原生存储** - Cloudflare KV 存储配置，R2 存储静态资源
- **可视化管理** - 完整的后台管理界面，支持拖拽排序
- **GitHub 集成** - OAuth 登录 + Issues 投稿系统
- **响应式设计** - 适配桌面端和移动端
- **主题切换** - 支持亮色/暗色/跟随系统
- **全文搜索** - 快速搜索导航项
- **视频导航** - 支持 Bilibili/YouTube 视频收藏

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Pages                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Next.js    │  │  KV Store   │  │       R2 Bucket     │  │
│  │  (Edge)     │◄─┤  (Config)   │  │  (Static Assets)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                                      │
         ▼                                      ▼
    ┌─────────┐                          ┌──────────────┐
    │ GitHub  │                          │   CDN Edge   │
    │  OAuth  │                          │   (Global)   │
    └─────────┘                          └──────────────┘
```

## 项目结构

```
NavDev/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API 路由
│   │   │   ├── navigation/    # 导航数据 API
│   │   │   ├── home/          # 首页数据 API
│   │   │   ├── resource/      # 资源上传 API
│   │   │   └── auth/          # 认证 API
│   │   ├── admin/             # 管理后台页面
│   │   ├── videos/            # 视频导航页面
│   │   ├── submit/            # 投稿页面
│   │   └── page.tsx           # 首页
│   ├── components/            # React 组件
│   │   ├── ui/               # shadcn/ui 基础组件
│   │   └── *.tsx             # 业务组件
│   ├── lib/                   # 工具函数
│   │   ├── storage.ts        # KV/R2 存储服务
│   │   └── data-loader.ts    # 数据加载器
│   ├── navdev/
│   │   └── content/          # 本地内容文件 (JSON)
│   └── types/                 # TypeScript 类型定义
├── public/
│   └── assets/               # 静态资源
├── scripts/
│   └── migrate.js            # 数据迁移脚本
├── .env.example              # 环境变量模板
└── wrangler.toml.example     # Wrangler 配置模板
```

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/)
- [Cloudflare 账号](https://dash.cloudflare.com/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### 1. 克隆项目

```bash
git clone https://github.com/your-username/NavDev.git
cd NavDev
pnpm install
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

### 3. 创建 Cloudflare 资源

```bash
# 创建 KV Namespace
wrangler kv namespace create NAVDEV_KV

# 创建 R2 Bucket
wrangler r2 bucket create navdev-assets
```

> 记录返回的 KV Namespace ID，后面需要用到。

### 4. 配置环境变量

```bash
# 复制配置模板
cp .env.example .env.local
cp wrangler.toml.example wrangler.toml
```

编辑 `.env.local`：

```bash
# Cloudflare 配置
CLOUDFLARE_KV_NAMESPACE_ID=<你的 KV Namespace ID>
CLOUDFLARE_R2_BUCKET_NAME=navdev-assets

# GitHub OAuth (管理员登录)
GITHUB_CLIENT_ID=<你的 GitHub Client ID>
GITHUB_CLIENT_SECRET=<你的 GitHub Client Secret>

# 其他配置...
```

编辑 `wrangler.toml`，填入 KV Namespace ID：

```toml
[[kv_namespaces]]
binding = "NAVDEV_KV"
id = "<你的 KV Namespace ID>"
```

### 5. 上传数据到 Cloudflare

```bash
node scripts/migrate.js
```

### 6. 本地开发

```bash
pnpm dev
```

访问 http://localhost:3000

### 7. 部署到 Cloudflare Pages

```bash
# 构建
pnpm run cf:build

# 部署
pnpm run cf:deploy
```

## 功能说明

### 首页导航

- 多级分类展示
- 快速搜索
- 响应式布局
- 平滑动画

### 管理后台

访问 `/admin` 进入管理后台（需要 GitHub OAuth 登录）。

- **站点设置** - 配置网站标题、描述、Logo、Favicon
- **导航管理** - 添加/编辑/删除导航分类和链接，支持拖拽排序
- **资源管理** - 管理上传的图片资源
- **视频管理** - 管理视频导航内容

### 投稿系统

访问 `/submit` 可以提交新网站。

- 填写网站信息
- 自动获取网站图标
- 通过 GitHub Issues 管理投稿

### 视频导航

访问 `/videos` 查看视频收藏。

- 支持 Bilibili/YouTube
- 内嵌播放器
- 分类管理

## 配置说明

### 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `CLOUDFLARE_KV_NAMESPACE_ID` | KV Namespace ID | ✅ |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 Bucket 名称 | ✅ |
| `GITHUB_CLIENT_ID` | GitHub OAuth App ID | ✅ |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Secret | ✅ |
| `GITHUB_PAT` | GitHub Personal Access Token | 投稿功能需要 |
| `AUTH_SECRET` | NextAuth 密钥 | ✅ |
| `R2_PUBLIC_URL` | R2 公开访问 URL | 可选 |

### GitHub OAuth App

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 创建 OAuth App
3. Homepage URL: `https://your-domain.com`
4. Callback URL: `https://your-domain.com/api/auth/callback/github`

### GitHub Personal Access Token (投稿功能)

投稿功能需要 GitHub PAT 来创建和管理 Issues。配置步骤：

1. 访问 [GitHub Personal Access Tokens](https://github.com/settings/tokens?type=beta)
2. 点击 "Generate new token" > "Fine-grained token"
3. 配置 Token：
   - **Token name**: `NavDev Submissions`
   - **Expiration**: 自定义过期时间（建议90天或更长）
   - **Repository access**: 选择 "Only select repositories"，然后选择你的 NavDev 仓库（例如 `frode117/NavDev`）
   - **Permissions**: 
     - Repository permissions > Issues: **Read and write**
4. 生成 Token 并复制到 `.env.local` 中的 `GITHUB_PAT` 变量

**重要提示**：
- PAT 过期后投稿功能将失效，需要重新生成
- 确保 PAT 有对应仓库的 Issues 读写权限
- 在 `.env.local` 中配置 `GITHUB_OWNER` 和 `GITHUB_REPO` 为你的实际仓库信息

### 生成密钥

```bash
# 生成 AUTH_SECRET
openssl rand -base64 32
```

## 迁移脚本

```bash
# 上传到 Cloudflare（远程）
node scripts/migrate.js

# 上传到本地测试环境
node scripts/migrate.js --local

# 强制重新上传
node scripts/migrate.js --force

# 自定义并发数（加速上传）
node scripts/migrate.js --parallel=20
```

## 开发命令

```bash
# 开发服务器
pnpm dev

# 构建
pnpm build

# 本地预览
pnpm start

# 代码检查
pnpm lint

# Cloudflare 构建
pnpm run cf:build

# Cloudflare 部署
pnpm run cf:deploy
```

## Docker 部署（可选）

```bash
# 构建镜像
pnpm run docker:build

# 开发环境
pnpm run docker:dev

# 生产环境
pnpm run docker:prod
```

## 技术栈

### 前端

- **框架**: Next.js 15 (App Router)
- **UI 库**: React 18
- **样式**: Tailwind CSS 4
- **组件**: shadcn/ui + Radix UI
- **状态管理**: React Query + SWR
- **表单**: React Hook Form + Zod
- **图标**: Lucide React
- **拖拽**: @hello-pangea/dnd
- **图表**: Recharts

### 后端

- **运行时**: Cloudflare Pages (Edge Runtime)
- **存储**: Cloudflare KV + R2
- **认证**: NextAuth.js + GitHub OAuth
- **API**: Next.js API Routes

### 开发工具

- **语言**: TypeScript 5
- **包管理**: pnpm
- **代码检查**: ESLint
- **部署工具**: Wrangler

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

[MIT License](LICENSE)

## 致谢

- [Next.js](https://nextjs.org/)
- [Cloudflare](https://www.cloudflare.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
