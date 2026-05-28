import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { kvGet, kvSet, KV_KEYS } from '@/lib/storage'
import { getFileContent } from '@/lib/github'
import type { NavigationData, NavigationItem } from '@/types/navigation'

export const runtime = 'edge'

const DEFAULT_NAVIGATION: NavigationData = {
  navigationItems: []
}

export async function GET() {
  try {
    const data = await kvGet<NavigationData>(KV_KEYS.NAVIGATION)
    if (data) {
      return NextResponse.json(data)
    }

    const githubData = await getFileContent('src/navdev/content/navigation.json') as NavigationData
    if (githubData?.navigationItems) {
      await kvSet(KV_KEYS.NAVIGATION, githubData)
      return NextResponse.json(githubData)
    }

    return NextResponse.json(DEFAULT_NAVIGATION)
  } catch (error) {
    console.error('Failed to fetch navigation data:', error)
    return NextResponse.json(DEFAULT_NAVIGATION)
  }
}

async function validateAndSaveNavigationData(data: NavigationData) {
  console.log('Received navigation data:', JSON.stringify(data, null, 2))

  if (!data || typeof data !== 'object') {
    console.error('Invalid data: not an object')
    throw new Error('Invalid navigation data: not an object')
  }

  if (!('navigationItems' in data)) {
    console.error('Missing navigationItems key')
    throw new Error('Invalid navigation data: missing navigationItems')
  }

  if (!Array.isArray(data.navigationItems)) {
    console.error('navigationItems is not an array', typeof data.navigationItems)
    throw new Error('Invalid navigation data: navigationItems must be an array')
  }

  const invalidItems = data.navigationItems.filter((item: NavigationItem) =>
    !item.id ||
    !item.title ||
    (item.items && !Array.isArray(item.items)) ||
    (item.subCategories && !Array.isArray(item.subCategories))
  )

  if (invalidItems.length > 0) {
    console.error('Invalid navigation items:', invalidItems)
    throw new Error('Invalid navigation data: some items are malformed')
  }

  await kvSet(KV_KEYS.NAVIGATION, data)
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const data = await request.json()
    await validateAndSaveNavigationData(data)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save navigation data:', error)
    return NextResponse.json(
      {
        error: 'Failed to save navigation data',
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
    await validateAndSaveNavigationData(data)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update navigation data:', error)
    return NextResponse.json(
      {
        error: 'Failed to update navigation data',
        details: (error as Error).message
      },
      { status: 500 }
    )
  }
} 