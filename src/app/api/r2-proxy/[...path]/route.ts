import { NextResponse } from 'next/server'
import { r2Get, getMimeType } from '@/lib/storage'

export const runtime = 'edge'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const key = path.join('/')

    const object = await r2Get(key)

    if (!object) {
      return new NextResponse('Not Found', { status: 404 })
    }

    const contentType = object.httpMetadata?.contentType || getMimeType(key)

    return new NextResponse(object.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': object.etag
      }
    })
  } catch (error) {
    console.error('Failed to fetch R2 object:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
