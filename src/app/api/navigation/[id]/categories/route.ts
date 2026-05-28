import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { kvGet, kvSet, KV_KEYS } from '@/lib/storage'
import type { NavigationData } from '@/types/navigation'

export const runtime = 'edge'

async function getNavigationData(): Promise<NavigationData> {
  const data = await kvGet<NavigationData>(KV_KEYS.NAVIGATION)
  return data || { navigationItems: [] }
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

    const { categoryId } = await request.json()
    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    const data = await getNavigationData()

    const navigation = data.navigationItems.find(nav => nav.id === id)
    if (!navigation) {
      return NextResponse.json({ error: 'Navigation not found' }, { status: 404 })
    }

    const categoryExists = navigation.subCategories?.some(cat => cat.id === categoryId)
    if (!categoryExists) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const updatedSubCategories = navigation.subCategories?.filter(cat => cat.id !== categoryId) || []

    const updatedNavigations = data.navigationItems.map(nav => {
      if (nav.id === id) {
        return {
          ...nav,
          subCategories: updatedSubCategories
        }
      }
      return nav
    })

    await kvSet(KV_KEYS.NAVIGATION, { navigationItems: updatedNavigations })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
