import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { kvGet, kvSet, KV_KEYS, r2Upload, r2Delete, getMimeType, getR2 } from '@/lib/storage'
import { getFileContent } from '@/lib/github'
import type { ResourceMetadata } from '@/types/resource-metadata'

export const runtime = 'edge'

const DEFAULT_METADATA: ResourceMetadata = {
  commit: '',
  generated: new Date().toUTCString(),
  metadata: []
}

function sanitizeFilename(name: string): { base: string; ext: string } {
  const safe = name.replace(/[/\\:*?"<>|]/g, '').trim()
  const lastDot = safe.lastIndexOf('.')
  if (lastDot > 0 && lastDot < safe.length - 1) {
    return { base: safe.slice(0, lastDot), ext: safe.slice(lastDot + 1).toLowerCase() }
  }
  return { base: safe || 'img', ext: '' }
}

async function getUniqueR2Key(folder: string, base: string, ext: string): Promise<string> {
  const r2 = await getR2()
  const fullExt = ext ? `.${ext}` : ''
  let key = `${folder}/${base}${fullExt}`
  if (!(await r2.head(key))) return key
  let counter = 1
  while (true) {
    key = `${folder}/${base}-${counter}${fullExt}`
    if (!(await r2.head(key))) return key
    counter++
  }
}

export async function GET() {
  try {
    const data = await kvGet<ResourceMetadata>(KV_KEYS.RESOURCE_METADATA)
    if (data?.metadata && Array.isArray(data.metadata)) {
      return NextResponse.json(data)
    }

    const githubData = await getFileContent('src/navdev/content/resource-metadata.json') as ResourceMetadata
    if (githubData?.metadata && Array.isArray(githubData.metadata)) {
      await kvSet(KV_KEYS.RESOURCE_METADATA, githubData)
      return NextResponse.json(githubData)
    }

    return NextResponse.json(DEFAULT_METADATA)
  } catch (error) {
    console.error('Failed to fetch resource metadata:', error)
    return NextResponse.json({ error: 'Failed to fetch resource metadata' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { image, filename } = await request.json()

    const base64Data = image.split(',')[1]
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

    const mimeMatch = image.match(/data:image\/([^;]+);/)
    const mimeExt = mimeMatch ? mimeMatch[1].replace('jpeg', 'jpg') : 'png'

    let base: string
    let ext: string
    if (filename) {
      const parsed = sanitizeFilename(filename)
      base = parsed.base || 'img'
      ext = parsed.ext || mimeExt
    } else {
      base = `img_${Date.now()}`
      ext = mimeExt
    }

    const r2Key = await getUniqueR2Key('assets', base, ext)
    const contentType = getMimeType(`file.${ext}`)
    const imageUrl = await r2Upload(r2Key, binaryData, contentType)

    const hash = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`

    let metadata = await kvGet<ResourceMetadata>(KV_KEYS.RESOURCE_METADATA)
    if (!metadata) {
      metadata = { ...DEFAULT_METADATA }
    }

    metadata.metadata.unshift({
      commit: hash,
      hash: hash,
      path: `/${r2Key}`
    })
    metadata.generated = new Date().toUTCString()

    await kvSet(KV_KEYS.RESOURCE_METADATA, metadata)

    return NextResponse.json({ success: true, imageUrl })
  } catch (error) {
    console.error('Failed to save resource:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save resource' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { resourceHashes } = await request.json()

    if (!Array.isArray(resourceHashes) || resourceHashes.length === 0) {
      return NextResponse.json({ error: 'Invalid resource hashes' }, { status: 400 })
    }

    const metadata = await kvGet<ResourceMetadata>(KV_KEYS.RESOURCE_METADATA)
    if (!metadata) {
      return NextResponse.json({ error: 'No metadata found' }, { status: 404 })
    }

    const toDelete = metadata.metadata.filter(item => resourceHashes.includes(item.hash))
    const r2Keys = toDelete.map(item => item.path.replace(/^\//, ''))

    if (r2Keys.length > 0) {
      await r2Delete(r2Keys)
    }

    const originalCount = metadata.metadata.length
    metadata.metadata = metadata.metadata.filter(item => !resourceHashes.includes(item.hash))
    const deletedCount = originalCount - metadata.metadata.length
    metadata.generated = new Date().toUTCString()

    await kvSet(KV_KEYS.RESOURCE_METADATA, metadata)

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Successfully deleted ${deletedCount} resource(s)`
    })
  } catch (error) {
    console.error('Failed to delete resources:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete resources' },
      { status: 500 }
    )
  }
}
