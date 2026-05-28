import type { CloudflareEnv, KVNamespace, R2Bucket, R2Object } from '@/types/cloudflare'

let cachedEnv: CloudflareEnv | null = null

export async function getCloudflareEnv(): Promise<CloudflareEnv> {
  if (cachedEnv) return cachedEnv

  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages')
    const ctx = getRequestContext()
    cachedEnv = ctx.env as CloudflareEnv
    return cachedEnv
  } catch {
    throw new Error('Cloudflare environment not available. Make sure you are running on Cloudflare Pages.')
  }
}

export async function getKV(): Promise<KVNamespace> {
  const env = await getCloudflareEnv()
  if (!env.NAVDEV_KV) {
    throw new Error('KV namespace NAVDEV_KV not bound')
  }
  return env.NAVDEV_KV
}

export async function getR2(): Promise<R2Bucket> {
  const env = await getCloudflareEnv()
  if (!env.NAVDEV_R2) {
    throw new Error('R2 bucket NAVDEV_R2 not bound')
  }
  return env.NAVDEV_R2
}

export async function getR2PublicUrl(): Promise<string> {
  const env = await getCloudflareEnv()
  return env.R2_PUBLIC_URL || ''
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const kv = await getKV()
  const value = await kv.get(key, { type: 'json' })
  return value as T | null
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const kv = await getKV()
  await kv.put(key, JSON.stringify(value))
}

export async function kvDelete(key: string): Promise<void> {
  const kv = await getKV()
  await kv.delete(key)
}

export async function r2Upload(
  key: string,
  data: ArrayBuffer | Uint8Array | ReadableStream | string,
  contentType?: string
): Promise<string> {
  const r2 = await getR2()
  const publicUrl = await getR2PublicUrl()

  await r2.put(key, data, {
    httpMetadata: contentType ? { contentType } : undefined
  })

  return publicUrl ? `${publicUrl}/${key}` : `/${key}`
}

export async function r2Get(key: string): Promise<R2Object | null> {
  const r2 = await getR2()
  return r2.get(key)
}

export async function r2Delete(key: string | string[]): Promise<void> {
  const r2 = await getR2()
  await r2.delete(key)
}

export async function r2List(prefix?: string): Promise<{ key: string; size: number; uploaded: Date }[]> {
  const r2 = await getR2()
  const result = await r2.list({ prefix })
  return result.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    uploaded: obj.uploaded
  }))
}

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'bmp': 'image/bmp'
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}

export const KV_KEYS = {
  NAVIGATION: 'navigation',
  SITE_CONFIG: 'site-config',
  RESOURCE_METADATA: 'resource-metadata',
  VIDEOS: 'videos'
} as const
