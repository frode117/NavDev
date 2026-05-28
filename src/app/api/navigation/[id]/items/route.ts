import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { kvGet, kvSet, KV_KEYS } from '@/lib/storage'
import type { NavigationData, NavigationSubItem } from '@/types/navigation'

export const runtime = 'edge'

async function getNavigationData(): Promise<NavigationData> {
  const data = await kvGet<NavigationData>(KV_KEYS.NAVIGATION)
  return data || { navigationItems: [] }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await getNavigationData()
    const item = data.navigationItems.find(item => item.id === id)

    if (!item) {
      return NextResponse.json({ error: 'Navigation not found' }, { status: 404 })
    }

    return NextResponse.json(item.items)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const newItem: NavigationSubItem = await request.json()
    const data = await getNavigationData()

    const updatedItems = data.navigationItems.map(item => {
      if (item.id === id) {
        return {
          ...item,
          items: [...(item.items || []), newItem]
        }
      }
      return item
    })

    await kvSet(KV_KEYS.NAVIGATION, { navigationItems: updatedItems })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { index, item }: { index: number, item: NavigationSubItem } = await request.json()
    const data = await getNavigationData()

    const navigation = data.navigationItems.find(nav => nav.id === id)
    if (!navigation) {
      return NextResponse.json({ error: 'Navigation not found' }, { status: 404 })
    }

    const updatedItems = [...(navigation.items || [])]
    updatedItems[index] = item

    const updatedNavigations = data.navigationItems.map(nav => {
      if (nav.id === id) {
        return {
          ...nav,
          items: updatedItems
        }
      }
      return nav
    })

    await kvSet(KV_KEYS.NAVIGATION, { navigationItems: updatedNavigations })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { index } = await request.json()
    const data = await getNavigationData()

    const navigation = data.navigationItems.find(nav => nav.id === id)
    if (!navigation) {
      return NextResponse.json({ error: 'Navigation not found' }, { status: 404 })
    }

    const updatedItems = (navigation.items || []).filter((_, i) => i !== index)
    const updatedNavigations = data.navigationItems.map(nav => {
      if (nav.id === id) {
        return {
          ...nav,
          items: updatedItems
        }
      }
      return nav
    })

    await kvSet(KV_KEYS.NAVIGATION, { navigationItems: updatedNavigations })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
