import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { kvGet, kvSet, KV_KEYS } from '@/lib/storage'
import type { NavigationData, NavigationItem } from '@/types/navigation'

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
      return new Response('Not Found', { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch navigation item' }, { status: 500 })
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

    const updatedItem: NavigationItem = await request.json()
    const data = await getNavigationData()

    const existingItem = data.navigationItems.find(item => item.id === id)
    if (!existingItem) {
      return new Response('Navigation item not found', { status: 404 })
    }

    const mergedItem: NavigationItem = {
      ...existingItem,
      ...updatedItem,
      id: id,
      items: updatedItem.items || existingItem.items || [],
      subCategories: updatedItem.subCategories || existingItem.subCategories || []
    }

    const updatedItems = data.navigationItems.map(item =>
      item.id === id ? mergedItem : item
    )

    await kvSet(KV_KEYS.NAVIGATION, { navigationItems: updatedItems })

    return NextResponse.json(mergedItem)
  } catch (error) {
    console.error('Update error:', error)
    return NextResponse.json({ error: 'Failed to update navigation' }, { status: 500 })
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

    const data = await getNavigationData()
    const updatedItems = data.navigationItems.filter(item => item.id !== id)

    await kvSet(KV_KEYS.NAVIGATION, { navigationItems: updatedItems })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete navigation' }, { status: 500 })
  }
}
