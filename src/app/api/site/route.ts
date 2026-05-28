import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { kvGet, kvSet, KV_KEYS } from '@/lib/storage'
import { getFileContent } from '@/lib/github'
import type { SiteInfo } from '@/types/site'

export const runtime = 'edge'

const DEFAULT_SITE: SiteInfo = {
  basic: {
    title: '',
    description: '',
    keywords: ''
  },
  appearance: {
    logo: '',
    favicon: '',
    theme: 'system'
  },
  navigation: {
    linkTarget: '_blank'
  }
}

export async function GET() {
  try {
    const data = await kvGet<SiteInfo>(KV_KEYS.SITE_CONFIG)
    if (data) {
      return NextResponse.json(data)
    }

    const githubData = await getFileContent('src/navdev/content/site.json') as SiteInfo
    if (githubData?.basic) {
      await kvSet(KV_KEYS.SITE_CONFIG, githubData)
      return NextResponse.json(githubData)
    }

    return NextResponse.json(DEFAULT_SITE)
  } catch (error) {
    console.error('Failed to read site data:', error)
    return NextResponse.json(DEFAULT_SITE)
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const data: SiteInfo = await request.json()
    await kvSet(KV_KEYS.SITE_CONFIG, data)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save site data:', error)
    return NextResponse.json(
      { error: 'Failed to save site data' },
      { status: 500 }
    )
  }
} 