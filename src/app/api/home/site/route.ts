import { NextResponse } from 'next/server'
import { kvGet, KV_KEYS } from '@/lib/storage'
import type { SiteInfo } from '@/types/site'
import siteDataFallback from '@/navdev/content/site.json'
import { processSiteData } from '@/lib/data-loader'

export const runtime = 'edge'

export async function GET() {
  try {
    const data = await kvGet<SiteInfo>(KV_KEYS.SITE_CONFIG)
    const rawData = data || siteDataFallback

    const processedData = processSiteData(rawData as any)

    return NextResponse.json(processedData, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=3600'
      }
    })
  } catch (error) {
    console.error('Error in site API:', error)
    const processedData = processSiteData(siteDataFallback as any)

    return NextResponse.json(processedData)
  }
}
