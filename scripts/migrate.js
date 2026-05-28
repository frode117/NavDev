#!/usr/bin/env node

/**
 * 高速并发上传脚本 - Cloudflare KV + R2
 *
 * 特性：
 * - 多线程并发上传（默认 10 并发）
 * - 自动上传到远程 Cloudflare
 * - 智能跳过已存在的文件
 * - 实时进度显示
 *
 * 使用方法：
 *   node scripts/migrate.js              # 默认 10 并发
 *   node scripts/migrate.js --parallel=20  # 自定义并发数
 *   node scripts/migrate.js --force      # 强制重新上传
 */

const fs = require('fs')
const path = require('path')
const { execSync, exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

// 配置
const KV_NAMESPACE_ID = 'c6e16d2b9ee54db5b3c36353dee89ad4'
const R2_BUCKET_NAME = 'navdev-assets'
const CONTENT_DIR = path.join(__dirname, '..', 'src', 'navdev', 'content')
const PUBLIC_ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets')

const KV_FILES = [
  { file: 'navigation.json', key: 'navigation' },
  { file: 'site.json', key: 'site-config' },
  { file: 'resource-metadata.json', key: 'resource-metadata' },
  { file: 'videos.json', key: 'videos' }
]

// 参数解析
const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const parallelArg = args.find(arg => arg.startsWith('--parallel='))
const PARALLEL_LIMIT = parallelArg ? parseInt(parallelArg.split('=')[1]) : 10

// 统计
let stats = {
  kv: { success: 0, skipped: 0, failed: 0 },
  r2: { success: 0, skipped: 0, failed: 0, total: 0 }
}

// 日志函数
function log(msg, type = 'info') {
  const icons = {
    info: '\x1b[34m●\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    warn: '\x1b[33m⚠\x1b[0m'
  }
  console.log(`${icons[type]} ${msg}`)
}

// 检查 KV key 是否存在
async function checkKVExists(key) {
  if (FORCE) return false

  try {
    await execAsync(`wrangler kv key get "${key}" --namespace-id="${KV_NAMESPACE_ID}" --remote`)
    return true
  } catch {
    return false
  }
}

// 上传单个 KV 文件
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

  // 检查是否已存在
  const exists = await checkKVExists(key)
  if (exists) {
    log(`${key}: 已存在`, 'success')
    stats.kv.skipped++
    return
  }

  // 上传
  try {
    const tempFile = path.join(__dirname, `temp-${key}.json`)
    fs.writeFileSync(tempFile, content)

    await execAsync(`wrangler kv key put "${key}" --path="${tempFile}" --namespace-id="${KV_NAMESPACE_ID}" --remote`)

    fs.unlinkSync(tempFile)

    log(`${key}: 上传成功`, 'success')
    stats.kv.success++
  } catch (error) {
    log(`${key}: 上传失败 - ${error.message}`, 'error')
    stats.kv.failed++
  }
}

// 上传 KV 数据
async function uploadKV() {
  console.log('\n' + '═'.repeat(60))
  log('📤 上传 KV 数据到 Cloudflare (远程)')
  console.log('═'.repeat(60))

  for (const kvFile of KV_FILES) {
    await uploadKVFile(kvFile)
  }
}

// 获取所有文件
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

// 获取 Content-Type
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

// 上传单个 R2 文件
async function uploadR2File({ fullPath, relativePath, size }) {
  const r2Key = `assets/${relativePath}`

  try {
    const contentType = getContentType(relativePath)
    let cmd = `wrangler r2 object put "${R2_BUCKET_NAME}/${r2Key}" --file="${fullPath}" --remote`

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

// 批量上传 R2 文件
async function uploadR2Batch(files) {
  const promises = files.map(file => uploadR2File(file))
  return await Promise.all(promises)
}

// 上传 R2 资源（并发）
async function uploadR2() {
  console.log('\n' + '═'.repeat(60))
  log(`🚀 上传 R2 资源到 Cloudflare (远程，${PARALLEL_LIMIT} 并发)`)
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

  // 分批处理
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

      // 更新进度
      const percent = Math.round((completed / files.length) * 100)
      const speed = (completed / ((Date.now() - startTime) / 1000)).toFixed(1)
      process.stdout.write(`\r  进度: ${completed}/${files.length} (${percent}%) | 速度: ${speed} 文件/秒`)
    })
  }

  console.log('\n')

  // 显示错误
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

// 主函数
async function main() {
  console.log('')
  log('⚡ Cloudflare 高速上传工具', 'info')
  console.log(`   并发数: ${PARALLEL_LIMIT} | 强制上传: ${FORCE ? '是' : '否'}`)

  const totalStart = Date.now()

  // 上传 KV
  await uploadKV()

  // 上传 R2
  await uploadR2()

  // 总结
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
