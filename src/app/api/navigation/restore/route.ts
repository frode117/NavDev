import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { kvSet, KV_KEYS } from '@/lib/storage'
import { getFileContent } from '@/lib/github'
import type { NavigationData } from '@/types/navigation'

export const runtime = 'edge'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    try {
      const defaultData = await getFileContent('src/navdev/content/navigation-default.json') as NavigationData

      if (!defaultData || typeof defaultData !== 'object' || !defaultData.navigationItems) {
        return NextResponse.json(
          {
            error: 'Invalid default data format',
            details: 'navigation-default.json does not contain valid navigation data'
          },
          { status: 400 }
        )
      }

      await kvSet(KV_KEYS.NAVIGATION, defaultData)

      return NextResponse.json(defaultData)
    } catch (fileError) {
      if ((fileError as Error).message.includes('404') || (fileError as Error).message.includes('not found')) {
        return NextResponse.json(
          {
            error: 'Default data file not found',
            details: 'navigation-default.json file does not exist in the repository'
          },
          { status: 404 }
        )
      }
      throw fileError
    }
  } catch (error) {
    console.error('Failed to restore navigation data:', error)
    return NextResponse.json(
      {
        error: 'Failed to restore navigation data',
        details: (error as Error).message
      },
      { status: 500 }
    )
  }
}
