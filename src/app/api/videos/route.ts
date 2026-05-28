import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { kvGet, kvSet, KV_KEYS } from '@/lib/storage'
import { getFileContent } from '@/lib/github'
import type { NavigationData } from '@/types/navigation'

export const runtime = 'edge'

const DEFAULT_VIDEOS: NavigationData = {
  navigationItems: []
}

async function getVideosData(): Promise<NavigationData> {
  const data = await kvGet<NavigationData>(KV_KEYS.VIDEOS)
  if (data) return data

  try {
    const githubData = await getFileContent('src/navdev/content/videos.json') as NavigationData
    if (githubData?.navigationItems) {
      await kvSet(KV_KEYS.VIDEOS, githubData)
      return githubData
    }
  } catch {
    // ignore
  }

  return DEFAULT_VIDEOS
}

export async function GET() {
  try {
    const data = await getVideosData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch videos data:', error)
    return NextResponse.json(DEFAULT_VIDEOS)
  }
}

async function validateAndSaveVideosData(data: NavigationData) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid videos data: not an object')
  }

  if (!('navigationItems' in data)) {
    throw new Error('Invalid videos data: missing navigationItems')
  }

  if (!Array.isArray(data.navigationItems)) {
    throw new Error('Invalid videos data: navigationItems must be an array')
  }

  await kvSet(KV_KEYS.VIDEOS, data)
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    await validateAndSaveVideosData(data)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save videos data:', error)
    return NextResponse.json(
      {
        error: 'Failed to save videos data',
        details: (error as Error).message
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    await validateAndSaveVideosData(data)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update videos data:', error)
    return NextResponse.json(
      {
        error: 'Failed to update videos data',
        details: (error as Error).message
      },
      { status: 500 }
    )
  }
}
