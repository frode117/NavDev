# 快速上传指南

## 一键上传到 Cloudflare

```bash
# 上传所有数据（自动跳过已存在的文件）
node scripts/migrate.js

# 如果出错，直接重新运行即可（会自动跳过已成功的）
node scripts/migrate.js
```

## 其他选项

```bash
# 预览模式（查看将上传什么）
node scripts/migrate.js --dry-run

# 强制重新上传所有文件
node scripts/migrate.js --force
```

## 上传结果说明

- ✓ 成功：文件已上传
- ⊘ 跳过：文件已存在，无需重复上传
- ✗ 失败：上传出错，重新运行脚本即可

## 常见问题

### Q: 上传失败怎么办？
A: 直接重新运行 `node scripts/migrate.js`，已成功的文件会自动跳过

### Q: 如何确认是否上传成功？
A: 检查脚本输出的统计信息，或访问 Cloudflare Dashboard

### Q: 网络不稳定导致中断？
A: 重新运行脚本，会从失败的地方继续

## 手动验证

### 检查 KV 数据
```bash
# 查看所有 key
wrangler kv key list --namespace-id=c6e16d2b9ee54db5b3c36353dee89ad4

# 查看具体内容
wrangler kv key get "navigation" --namespace-id=c6e16d2b9ee54db5b3c36353dee89ad4
```

### 检查 R2 文件
```bash
# 在 Cloudflare Dashboard 中查看
# https://dash.cloudflare.com/ -> R2 -> navdev-assets
```

## 配置信息

- KV Namespace ID: `c6e16d2b9ee54db5b3c36353dee89ad4`
- R2 Bucket: `navdev-assets`
- 上传内容：
  - KV: 4 个配置文件
  - R2: 46 个资源文件 (~0.19 MB)
