import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { kvGet, kvSet, KV_KEYS } from '@/lib/storage'
import type { NavigationData } from '@/types/navigation'

export const runtime = 'edge'

async function getNavigationData(): Promise<NavigationData> {
  const data = await kvGet<NavigationData>(KV_KEYS.NAVIGATION)
  return data || { navigationItems: [] }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { sourceIndex, destinationIndex } = await request.json()

    const data = await getNavigationData()

    if (!data.navigationItems || !Array.isArray(data.navigationItems)) {
      throw new Error('Invalid navigation data')
    }

    const updatedItems = [...data.navigationItems]
    const [movedItem] = updatedItems.splice(sourceIndex, 1)
    updatedItems.splice(destinationIndex, 0, movedItem)

    await kvSet(KV_KEYS.NAVIGATION, { navigationItems: updatedItems })

    return NextResponse.json(updatedItems, { status: 200 })
  } catch (error) {
    console.error('Reorder navigation error:', error)
    return NextResponse.json({
      error: 'Failed to reorder navigation',
      details: (error as Error).message
    }, { status: 500 })
  }
}
