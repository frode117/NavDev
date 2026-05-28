# NavDev - 开发导航

## 项目简介

NavDev 是一个基于 Next.js 15 和 Cloudflare 边缘计算构建的现代化导航管理平台。采用 **Cloudflare KV** 存储数据、**Cloudflare R2** 存储图片资源，实现数据更新无需重新部署，提供即时响应的用户体验。

### 架构特点

```
┌─────────────────────────────────────────────────────────┐
│                  Cloudflare Pages                        │
│                   (静态代码/UI)                          │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   KV 存储      │   │   R2 存储      │   │   GitHub      │
│               │   │               │   │   OAuth       │
│ • navigation  │   │ • /assets/*   │   │               │
│ • site-config │   │ • 图片资源     │   │ 用户认证      │
│ • videos      │   │               │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
```

### 核心优势

- **即时更新**: 数据存储在 KV，修改后立即生效，无需重新部署
- **边缘计算**: 基于 Cloudflare Workers，全球低延迟访问
- **自动刷新**: 主页支持 SWR 自动刷新，切换标签页即可看到最新数据
- **图片托管**: R2 存储图片资源，通过代理路由访问

## 核心功能

### 视频导航
- 支持 Bilibili 和 YouTube 视频
- 内嵌播放器，无需跳转
- 自定义封面图片
- 多级分类管理

### 网址导航
- 智能获取网站信息（标题、描述、图标）
- 主分类 → 子分类 → 站点 三级结构
- 拖拽排序
- 启用/禁用控制

### 管理后台
- GitHub OAuth 安全登录
- 可视化分类管理
- Monaco Editor JSON 编辑
- 资源文件管理

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 15.5.7 | React 全栈框架 |
| Cloudflare Pages | - | 边缘部署平台 |
| Cloudflare KV | - | 键值数据存储 |
| Cloudflare R2 | - | 对象存储（图片） |
| React | 18.2.0 | UI 框架 |
| TypeScript | 5.1.6 | 类型安全 |
| Tailwind CSS | 4.1.12 | 样式框架 |
| SWR | 2.2.5 | 数据获取与缓存 |
| NextAuth.js | 5.0.0-beta.25 | 身份认证 |

## 快速开始

### 环境要求

- Node.js 20.0+
- pnpm 8.0+（推荐）
- Cloudflare 账户
- GitHub 账户

### 1. 克隆项目

```bash
git clone https://github.com/frode117/NavDev.git
cd NavDev
pnpm install
```

### 2. 创建 Cloudflare 资源

```bash
# 安装 wrangler CLI
pnpm add -g wrangler

# 登录 Cloudflare
wrangler login

# 创建 KV namespace
wrangler kv namespace create NAVDEV_KV
# 记录返回的 id

# 创建 R2 bucket
wrangler r2 bucket create navdev-assets
```

### 3. 配置 wrangler.toml

复制 `wrangler.toml.example` 为 `wrangler.toml` 并填入你的配置：

```bash
cp wrangler.toml.example wrangler.toml
```

> **安全提示**: `wrangler.toml` 已被添加到 `.gitignore`，不会被提交到仓库。请勿在公开仓库中提交包含敏感信息的配置文件。

配置示例：

```toml
name = "navdev"
compatibility_date = "2024-11-11"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"

[[kv_namespaces]]
binding = "NAVDEV_KV"
id = "<你的KV_NAMESPACE_ID>"

[[r2_buckets]]
binding = "NAVDEV_R2"
bucket_name = "navdev-assets"

[env.production.vars]
GITHUB_CLIENT_ID = "<你的GitHub_Client_ID>"
GITHUB_OWNER = "<你的GitHub用户名>"
GITHUB_REPO = "<你的仓库名>"
GITHUB_BRANCH = "main"
NEXTAUTH_URL = "https://your-domain.com/api/auth"
R2_PUBLIC_URL = "https://your-r2-domain.com"
```

### 4. 配置环境变量

创建 `.env.local`:

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret

# GitHub 仓库（用于投稿功能）
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo
GITHUB_BRANCH=main
GITHUB_PAT=your-personal-access-token

# NextAuth
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=your-random-secret

# R2 公开访问 URL（可选）
R2_PUBLIC_URL=https://your-r2-public-domain.com
```

### 5. 数据迁移

如果有现有数据，运行迁移脚本：

```bash
node scripts/migrate-to-cloudflare.js
```

### 6. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

## 部署到 Cloudflare Pages

### 方式一：通过 Dashboard

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 Pages，点击 "Create a project"
3. 连接 GitHub 仓库
4. 配置构建设置：
   - 构建命令: `pnpm install && pnpm run cf:build`
   - 输出目录: `.next`
5. 添加环境变量
6. 绑定 KV 和 R2

### 方式二：通过 CLI

```bash
# 构建
pnpm run cf:build

# 部署
pnpm run cf:deploy
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
│   │   │   └── r2-proxy/      # R2 图片代理
│   │   ├── admin/             # 管理后台页面
│   │   └── (public)/          # 公开页面
│   ├── components/            # React 组件
│   ├── lib/
│   │   ├── storage.ts         # KV/R2 存储服务
│   │   ├── auth.ts            # 认证配置
│   │   └── data-loader.ts     # 数据处理
│   └── types/                 # TypeScript 类型
├── public/                    # 静态资源
├── scripts/
│   └── migrate-to-cloudflare.js  # 数据迁移脚本
├── wrangler.toml              # Cloudflare 配置
└── next.config.js             # Next.js 配置
```

## 数据存储

### KV 键值

| Key | 内容 |
|-----|------|
| `navigation` | 网址导航数据 |
| `site-config` | 站点配置 |
| `videos` | 视频导航数据 |
| `resource-metadata` | 资源元数据 |

### R2 目录

```
navdev-assets/
├── assets/           # 通用图片资源
│   └── img_xxx.png
├── cover/            # 视频封面
│   └── cover_xxx.jpg
└── icons/            # 网站图标
    └── icon_xxx.png
```

## 数据格式

### navigation（网址导航）

```json
{
  "navigationItems": [
    {
      "id": "category-1",
      "title": "常用推荐",
      "icon": "Star",
      "description": "常用网站",
      "enabled": true,
      "subCategories": [
        {
          "id": "sub-1",
          "title": "AI 工具",
          "icon": "Brain",
          "enabled": true,
          "items": [
            {
              "id": "item-1",
              "title": "ChatGPT",
              "href": "https://chat.openai.com",
              "description": "OpenAI 聊天助手",
              "icon": "/assets/chatgpt.png",
              "enabled": true
            }
          ]
        }
      ]
    }
  ]
}
```

## 常用命令

```bash
# 开发
pnpm dev

# 构建
pnpm build

# Cloudflare 构建
pnpm run cf:build

# 部署到 Cloudflare
pnpm run cf:deploy

# 清理构建缓存
pnpm run clean

# Docker 部署
pnpm run docker:build
pnpm run docker:prod
```

## 常见问题

### 图片无法显示

检查 R2 代理路由是否正确配置。图片通过 `/api/r2-proxy/` 访问。

### 数据更新后主页未刷新

主页使用 SWR 自动刷新，切换标签页或等待几秒后会自动更新。

### KV 数据未同步

确保 wrangler.toml 中的 KV namespace ID 正确，并且已绑定到 Pages 项目。

### 构建失败

```bash
# 清理并重新安装
pnpm run clean
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm build
```

## 许可证

[MIT License](LICENSE)

## 致谢

- [Next.js](https://nextjs.org/)
- [Cloudflare](https://www.cloudflare.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)