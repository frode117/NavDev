#!/usr/bin/env node

/**
 * NavDev Cloudflare 数据迁移脚本
 *
 * 将本地数据上传到 Cloudflare KV 和 R2
 *
 * 使用方法：
 *   node scripts/migrate.js              # 默认 10 并发上传
 *   node scripts/migrate.js --parallel=20  # 自定义并发数
 *   node scripts/migrate.js --force      # 强制重新上传
 *   node scripts/migrate.js --local      # 上传到本地测试环境
 *
 * 环境变量：
 *   CLOUDFLARE_KV_NAMESPACE_ID  - KV Namespace ID (必需)
 *   CLOUDFLARE_R2_BUCKET_NAME   - R2 Bucket 名称 (默认: navdev-assets)
 */

const fs = require('fs')
const path = require('path')
const { execSync, exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

// ============================================
// 配置加载
// ============================================

// 尝试加载 .env.local 文件
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    content.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        const value = valueParts.join('=')
        if (key && value && !process.env[key]) {
          process.env[key] = value
        }
      }
    })
  }
}

loadEnvFile()

// 从环境变量获取配置
const KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'navdev-assets'

// 路径配置
const CONTENT_DIR = path.join(__dirname, '..', 'src', 'navdev', 'content')
const PUBLIC_ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets')

// KV 文件映射
const KV_FILES = [
  { file: 'navigation.json', key: 'navigation' },
  { file: 'site.json', key: 'site-config' },
  { file: 'resource-metadata.json', key: 'resource-metadata' },
  { file: 'videos.json', key: 'videos' }
]

// ============================================
// 参数解析
// ============================================

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const USE_LOCAL = args.includes('--local')
const parallelArg = args.find(arg => arg.startsWith('--parallel='))
const PARALLEL_LIMIT = parallelArg ? parseInt(parallelArg.split('=')[1]) : 10

const REMOTE_FLAG = USE_LOCAL ? '--local' : '--remote'

// ============================================
// 统计
// ============================================

let stats = {
  kv: { success: 0, skipped: 0, failed: 0 },
  r2: { success: 0, skipped: 0, failed: 0, total: 0 }
}

// ============================================
// 日志函数
// ============================================

function log(msg, type = 'info') {
  const icons = {
    info: '\x1b[34m●\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    warn: '\x1b[33m⚠\x1b[0m'
  }
  console.log(`${icons[type]} ${msg}`)
}

function logError(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`)
}

// ============================================
// 配置验证
// ============================================

function validateConfig() {
  const errors = []

  if (!KV_NAMESPACE_ID) {
    errors.push('CLOUDFLARE_KV_NAMESPACE_ID 未设置')
  }

  if (!R2_BUCKET_NAME) {
    errors.push('CLOUDFLARE_R2_BUCKET_NAME 未设置')
  }

  if (errors.length > 0) {
    console.log('')
    logError('配置错误：')
    console.log('')
    errors.forEach(e => console.log(`  • ${e}`))
    console.log('')
    console.log('请设置环境变量或在 .env.local 文件中配置：')
    console.log('')
    console.log('  # 方法 1: 环境变量')
    console.log('  export CLOUDFLARE_KV_NAMESPACE_ID=your-kv-namespace-id')
    console.log('')
    console.log('  # 方法 2: .env.local 文件')
    console.log('  CLOUDFLARE_KV_NAMESPACE_ID=your-kv-namespace-id')
    console.log('')
    console.log('获取 KV Namespace ID:')
    console.log('  1. 运行: wrangler kv namespace create NAVDEV_KV')
    console.log('  2. 复制返回的 id 值')
    console.log('')
    process.exit(1)
  }
}

// ============================================
// KV 操作
// ============================================

async function checkKVExists(key) {
  if (FORCE) return false

  try {
    await execAsync(`wrangler kv key get "${key}" --namespace-id="${KV_NAMESPACE_ID}" ${REMOTE_FLAG}`)
    return true
  } catch {
    return false
  }
}

async function uploadKVFile({ file, key }) {
  const filePath = path.join(CONTENT_DIR, file)

  if (!fs.existsSync(filePath)) {
    log(`KV 文件不存在: ${file}`, 'error')
    stats.kv.failed++
    return
  }

  const content = fs.readFileSync(filePath, 'utf-8')

  try {
    JSON.parse(content)
  } catch {
    log(`JSON 格式错误: ${file}`, 'error')
    stats.kv.failed++
    return
  }

  const exists = await checkKVExists(key)
  if (exists) {
    log(`${key}: 已存在，跳过`, 'success')
    stats.kv.skipped++
    return
  }

  try {
    const tempFile = path.join(__dirname, `temp-${key}.json`)
    fs.writeFileSync(tempFile, content)

    await execAsync(`wrangler kv key put "${key}" --path="${tempFile}" --namespace-id="${KV_NAMESPACE_ID}" ${REMOTE_FLAG}`)

    fs.unlinkSync(tempFile)

    log(`${key}: 上传成功`, 'success')
    stats.kv.success++
  } catch (error) {
    log(`${key}: 上传失败 - ${error.message}`, 'error')
    stats.kv.failed++
  }
}

async function uploadKV() {
  console.log('\n' + '═'.repeat(60))
  log(`📤 上传 KV 数据 (${USE_LOCAL ? '本地' : '远程'})`)
  console.log('═'.repeat(60))

  for (const kvFile of KV_FILES) {
    await uploadKVFile(kvFile)
  }
}

// ============================================
// R2 操作
// ============================================

function getAllFiles(dir, baseDir = dir) {
  const files = []
  if (!fs.existsSync(dir)) return files

  const items = fs.readdirSync(dir)
  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir))
    } else {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/')
      files.push({ fullPath, relativePath, size: stat.size })
    }
  }
  return files
}

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase()
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp'
  }
  return types[ext] || null
}

async function uploadR2File({ fullPath, relativePath, size }) {
  const r2Key = `assets/${relativePath}`

  try {
    const contentType = getContentType(relativePath)
    let cmd = `wrangler r2 object put "${R2_BUCKET_NAME}/${r2Key}" --file="${fullPath}" ${REMOTE_FLAG}`

    if (contentType) {
      cmd += ` --content-type="${contentType}"`
    }

    await execAsync(cmd)

    stats.r2.success++
    return { success: true, size }
  } catch (error) {
    stats.r2.failed++
    return { success: false, error: error.message, file: relativePath }
  }
}

async function uploadR2Batch(files) {
  const promises = files.map(file => uploadR2File(file))
  return await Promise.all(promises)
}

async function uploadR2() {
  console.log('\n' + '═'.repeat(60))
  log(`🚀 上传 R2 资源 (${USE_LOCAL ? '本地' : '远程'}, ${PARALLEL_LIMIT} 并发)`)
  console.log('═'.repeat(60))

  const files = getAllFiles(PUBLIC_ASSETS_DIR)

  if (files.length === 0) {
    log('没有找到需要上传的文件', 'warn')
    return
  }

  stats.r2.total = files.length
  log(`找到 ${files.length} 个文件`)

  const startTime = Date.now()
  let completed = 0
  let totalSize = 0
  const errors = []

  for (let i = 0; i < files.length; i += PARALLEL_LIMIT) {
    const batch = files.slice(i, i + PARALLEL_LIMIT)
    const results = await uploadR2Batch(batch)

    results.forEach(result => {
      completed++
      if (result.success) {
        totalSize += result.size
      } else {
        errors.push(result)
      }

      const percent = Math.round((completed / files.length) * 100)
      const speed = (completed / ((Date.now() - startTime) / 1000)).toFixed(1)
      process.stdout.write(`\r  进度: ${completed}/${files.length} (${percent}%) | 速度: ${speed} 文件/秒`)
    })
  }

  console.log('\n')

  if (errors.length > 0 && errors.length <= 5) {
    console.log('\n上传失败的文件:')
    errors.forEach(({ file, error }) => {
      log(`  ${file}: ${error}`, 'error')
    })
  } else if (errors.length > 5) {
    log(`  ${errors.length} 个文件上传失败`, 'error')
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  log(`上传完成: ${stats.r2.success}/${files.length} 成功 (${(totalSize / 1024 / 1024).toFixed(2)} MB, 用时 ${duration}s)`)
}

// ============================================
// 主函数
// ============================================

async function main() {
  console.log('')
  log('⚡ NavDev Cloudflare 迁移工具', 'info')

  // 验证配置
  validateConfig()

  console.log(`   KV Namespace: ${KV_NAMESPACE_ID}`)
  console.log(`   R2 Bucket: ${R2_BUCKET_NAME}`)
  console.log(`   并发数: ${PARALLEL_LIMIT} | 强制上传: ${FORCE ? '是' : '否'} | 模式: ${USE_LOCAL ? '本地' : '远程'}`)

  const totalStart = Date.now()

  await uploadKV()
  await uploadR2()

  const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(1)

  console.log('\n' + '═'.repeat(60))
  log('📊 上传总结')
  console.log('═'.repeat(60))
  console.log(`
  KV 数据:
    ✓ 成功: ${stats.kv.success}
    ⊘ 跳过: ${stats.kv.skipped}
    ✗ 失败: ${stats.kv.failed}

  R2 资源:
    ✓ 成功: ${stats.r2.success}
    ✗ 失败: ${stats.r2.failed}

  总用时: ${totalDuration} 秒
  `)

  if (stats.kv.failed > 0 || stats.r2.failed > 0) {
    log('⚠ 有文件上传失败，请重新运行脚本', 'warn')
    process.exit(1)
  } else {
    log('✓ 所有文件上传成功！', 'success')
    console.log('\n下一步:')
    console.log('  1. 访问 Cloudflare Dashboard 验证')
    console.log('     https://dash.cloudflare.com/')
    console.log('  2. 部署应用: wrangler pages deploy')
  }
}

main().catch(error => {
  console.error('')
  log(`上传失败: ${error.message}`, 'error')
  console.error(error.stack)
  process.exit(1)
})
