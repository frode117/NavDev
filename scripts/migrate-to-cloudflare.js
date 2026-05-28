#!/usr/bin/env node

/**
 * Migration script for NavDev: GitHub -> Cloudflare KV + R2
 *
 * Prerequisites:
 * 1. Create KV namespace: wrangler kv namespace create NAVDEV_KV
 * 2. Create R2 bucket: wrangler r2 bucket create navdev-assets
 * 3. Update wrangler.toml with the KV namespace ID
 *
 * Usage:
 * node scripts/migrate-to-cloudflare.js [options]
 *
 * Options:
 *   --dry-run     Preview changes without executing
 *   --kv-only     Only migrate KV data
 *   --r2-only     Only migrate R2 assets
 *   --cleanup     Remove unused images before migration
 *   --local       Use local storage (for testing)
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const KV_ONLY = args.includes('--kv-only')
const R2_ONLY = args.includes('--r2-only')
const CLEANUP = args.includes('--cleanup')
const USE_LOCAL = args.includes('--local')

const REMOTE_FLAG = USE_LOCAL ? '--local' : '--remote'

const KV_NAMESPACE_ID = '<YOUR_KV_NAMESPACE_ID>'
const R2_BUCKET_NAME = 'navdev-assets'

const CONTENT_DIR = path.join(__dirname, '..', 'src', 'navdev', 'content')
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const PUBLIC_ASSETS_DIR = path.join(PUBLIC_DIR, 'assets')

const KV_FILES = [
  { file: 'navigation.json', key: 'navigation' },
  { file: 'site.json', key: 'site-config' },
  { file: 'resource-metadata.json', key: 'resource-metadata' },
  { file: 'videos.json', key: 'videos' }
]

function log(message, type = 'info') {
  const prefix = {
    info: '\x1b[34m[INFO]\x1b[0m',
    success: '\x1b[32m[SUCCESS]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m',
    progress: '\x1b[36m[PROGRESS]\x1b[0m'
  }
  console.log(`${prefix[type]} ${message}`)
}

function progressBar(current, total, width = 40) {
  const percent = Math.round((current / total) * 100)
  const filled = Math.round((current / total) * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return `[${bar}] ${percent}% (${current}/${total})`
}

function getUsedAssets() {
  const usedAssets = new Set()

  const navigationPath = path.join(CONTENT_DIR, 'navigation.json')
  if (fs.existsSync(navigationPath)) {
    const content = fs.readFileSync(navigationPath, 'utf-8')
    const matches = content.match(/\/assets\/[^"'\s]+/g) || []
    matches.forEach(m => usedAssets.add(m))
  }

  const sitePath = path.join(CONTENT_DIR, 'site.json')
  if (fs.existsSync(sitePath)) {
    const content = fs.readFileSync(sitePath, 'utf-8')
    const matches = content.match(/\/assets\/[^"'\s]+/g) || []
    matches.forEach(m => usedAssets.add(m))
  }

  const metadataPath = path.join(CONTENT_DIR, 'resource-metadata.json')
  if (fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    if (metadata.metadata) {
      metadata.metadata.forEach(item => {
        if (item.path) usedAssets.add(item.path)
      })
    }
  }

  return usedAssets
}

function getAllFiles(dir, baseDir = dir) {
  const files = []

  if (!fs.existsSync(dir)) {
    return files
  }

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

function cleanupUnusedAssets() {
  log('Analyzing asset usage...')

  const usedAssets = getUsedAssets()
  log(`Found ${usedAssets.size} assets referenced in configuration`)

  const allFiles = getAllFiles(PUBLIC_ASSETS_DIR)
  const unusedFiles = []

  for (const file of allFiles) {
    const assetPath = `/assets/${file.relativePath}`
    if (!usedAssets.has(assetPath)) {
      const ext = path.extname(file.fullPath).toLowerCase()
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'].includes(ext)) {
        unusedFiles.push(file)
      }
    }
  }

  if (unusedFiles.length === 0) {
    log('No unused assets found', 'success')
    return { removed: 0, keptCount: allFiles.length }
  }

  log(`Found ${unusedFiles.length} unused assets`, 'warn')

  let removedCount = 0
  let freedSpace = 0

  for (let i = 0; i < unusedFiles.length; i++) {
    const file = unusedFiles[i]
    process.stdout.write(`\r${progressBar(i + 1, unusedFiles.length)} Cleaning: ${file.relativePath.substring(0, 30)}...`)

    if (DRY_RUN) {
      log(`\n[DRY RUN] Would delete: ${file.relativePath} (${(file.size / 1024).toFixed(2)} KB)`)
    } else {
      try {
        fs.unlinkSync(file.fullPath)
        removedCount++
        freedSpace += file.size
      } catch (error) {
        log(`\nFailed to delete ${file.relativePath}: ${error.message}`, 'error')
      }
    }
  }

  console.log('')
  log(`Cleanup completed: removed ${removedCount} files, freed ${(freedSpace / 1024 / 1024).toFixed(2)} MB`, 'success')

  return { removed: removedCount, keptCount: allFiles.length - removedCount }
}

function migrateKV() {
  log('Starting KV migration...')
  log(`Using namespace ID: ${KV_NAMESPACE_ID}`)
  log(`Storage mode: ${USE_LOCAL ? 'LOCAL' : 'REMOTE'}`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < KV_FILES.length; i++) {
    const { file, key } = KV_FILES[i]
    const filePath = path.join(CONTENT_DIR, file)

    process.stdout.write(`\r${progressBar(i + 1, KV_FILES.length)} Migrating: ${file}`)

    if (!fs.existsSync(filePath)) {
      log(`\nFile not found: ${filePath}`, 'warn')
      errorCount++
      continue
    }

    const content = fs.readFileSync(filePath, 'utf-8')

    try {
      JSON.parse(content)
    } catch {
      log(`\nInvalid JSON in ${file}`, 'error')
      errorCount++
      continue
    }

    if (DRY_RUN) {
      log(`\n[DRY RUN] Would write ${file} to KV key: ${key}`)
      successCount++
      continue
    }

    try {
      const tempFile = path.join(__dirname, `temp-${key}.json`)
      fs.writeFileSync(tempFile, content)

      const cmd = `wrangler kv key put "${key}" --path="${tempFile}" --namespace-id="${KV_NAMESPACE_ID}" ${REMOTE_FLAG}`
      execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' })

      fs.unlinkSync(tempFile)
      successCount++
    } catch (error) {
      log(`\nFailed to migrate ${file}: ${error.message}`, 'error')
      errorCount++
    }
  }

  console.log('')
  log(`KV migration completed: ${successCount} succeeded, ${errorCount} failed`, successCount > 0 ? 'success' : 'error')
}

function migrateR2() {
  log('Starting R2 migration...')
  log(`Target bucket: ${R2_BUCKET_NAME}`)
  log(`Storage mode: ${USE_LOCAL ? 'LOCAL' : 'REMOTE'}`)

  const files = getAllFiles(PUBLIC_ASSETS_DIR)
  log(`Found ${files.length} files to migrate`)

  if (files.length === 0) {
    log('No files to migrate', 'warn')
    return
  }

  let successCount = 0
  let errorCount = 0
  let totalSize = 0

  for (let i = 0; i < files.length; i++) {
    const { fullPath, relativePath, size } = files[i]
    const r2Key = `assets/${relativePath}`

    const shortName = relativePath.length > 35 ? '...' + relativePath.slice(-32) : relativePath
    process.stdout.write(`\r${progressBar(i + 1, files.length)} Uploading: ${shortName.padEnd(35)}`)

    if (DRY_RUN) {
      successCount++
      totalSize += size
      continue
    }

    try {
      const contentType = getContentType(relativePath)
      let cmd = `wrangler r2 object put "${R2_BUCKET_NAME}/${r2Key}" --file="${fullPath}" ${REMOTE_FLAG}`
      if (contentType) {
        cmd += ` --content-type="${contentType}"`
      }

      execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' })
      successCount++
      totalSize += size
    } catch (error) {
      log(`\nFailed to upload ${relativePath}: ${error.message}`, 'error')
      errorCount++
    }
  }

  console.log('')
  log(`R2 migration completed: ${successCount} files (${(totalSize / 1024 / 1024).toFixed(2)} MB), ${errorCount} failed`,
    successCount > 0 ? 'success' : 'error')
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
    '.bmp': 'image/bmp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.css': 'text/css',
    '.js': 'application/javascript'
  }
  return types[ext] || null
}

function printSummary() {
  console.log('')
  log('='.repeat(60))
  log('Migration Summary')
  log('='.repeat(60))
  console.log('')
  console.log('  Storage Mode:', USE_LOCAL ? 'LOCAL (testing)' : 'REMOTE (production)')
  console.log('  Dry Run:', DRY_RUN ? 'Yes' : 'No')
  console.log('  KV Namespace:', KV_NAMESPACE_ID)
  console.log('  R2 Bucket:', R2_BUCKET_NAME)
  console.log('')

  if (!DRY_RUN && !USE_LOCAL) {
    log('Data has been migrated to Cloudflare!', 'success')
    console.log('')
    console.log('  Next steps:')
    console.log('  1. Verify data in Cloudflare Dashboard')
    console.log('     - KV: https://dash.cloudflare.com/ -> Workers & Pages -> KV')
    console.log('     - R2: https://dash.cloudflare.com/ -> R2')
    console.log('  2. Configure R2 public access or custom domain')
    console.log('  3. Deploy application: wrangler pages deploy')
  }
}

async function main() {
  console.log('')
  log('NavDev Migration Script v2.0')
  log('='.repeat(60))

  if (DRY_RUN) {
    log('Running in DRY RUN mode - no changes will be made', 'warn')
  }

  if (USE_LOCAL) {
    log('Using LOCAL storage for testing', 'warn')
  }

  if (CLEANUP && !R2_ONLY) {
    console.log('')
    cleanupUnusedAssets()
  }

  if (!R2_ONLY) {
    console.log('')
    migrateKV()
  }

  if (!KV_ONLY) {
    console.log('')
    migrateR2()
  }

  printSummary()
}

main().catch(error => {
  log(`Migration failed: ${error.message}`, 'error')
  process.exit(1)
})
