import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { kvGet, kvSet, KV_KEYS } from '@/lib/storage'
import type { NavigationData, NavigationItem } from '@/types/navigation'

export const runtime = 'edge'

async function getNavigationData(): Promise<NavigationData> {
  const data = await kvGet<NavigationData>(KV_KEYS.NAVIGATION)
  return data || { navigationItems: [] }
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
      subCategories: [
        ...(
          [
            ...(existingItem.subCategories || []),
            ...(updatedItem.subCategories || [])
          ].reduce((acc, sub) => {
            const exist = acc.get(sub.id);
            acc.set(sub.id, {
              ...exist,
              ...sub,
              items: [
                ...(exist?.items || []),
                ...(sub.items || [])
              ]
            });
            return acc;
          }, new Map<string, NavigationItem>())
        ).values()
      ]
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
