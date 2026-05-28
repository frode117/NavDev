import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { kvGet, kvSet, KV_KEYS } from '@/lib/storage'
import type { NavigationItem, NavigationData } from '@/types/navigation'

export const runtime = 'edge'

async function getVideosData(): Promise<NavigationData> {
  const data = await kvGet<NavigationData>(KV_KEYS.VIDEOS)
  return data || { navigationItems: [] }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await getVideosData()
    const item = data.navigationItems.find((item: NavigationItem) => item.id === id)

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error('Failed to fetch videos data:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch videos data',
        details: (error as Error).message
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { id } = await params
    const updatedItem = await request.json()
    const data = await getVideosData()

    const index = data.navigationItems.findIndex((item: NavigationItem) => item.id === id)
    if (index === -1) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    data.navigationItems[index] = {
      ...data.navigationItems[index],
      ...updatedItem
    }

    await kvSet(KV_KEYS.VIDEOS, data)

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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { id } = await params
    const data = await getVideosData()

    const index = data.navigationItems.findIndex((item: NavigationItem) => item.id === id)
    if (index === -1) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    data.navigationItems.splice(index, 1)

    await kvSet(KV_KEYS.VIDEOS, data)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete videos data:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete videos data',
        details: (error as Error).message
      },
      { status: 500 }
    )
  }
}
