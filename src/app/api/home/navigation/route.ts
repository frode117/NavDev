import { NextResponse } from 'next/server'
import { kvGet, KV_KEYS } from '@/lib/storage'
import type { NavigationData } from '@/types/navigation'
import navigationDataFallback from '@/navdev/content/navigation.json'
import { processNavigationData, filterNavigationData } from '@/lib/data-loader'

export const runtime = 'edge'

export async function GET() {
  try {
    const data = await kvGet<NavigationData>(KV_KEYS.NAVIGATION)
    const rawData = data || navigationDataFallback

    const processedData = processNavigationData(rawData as any)
    const filteredData = filterNavigationData(processedData)

    return NextResponse.json(filteredData, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error in navigation API:', error)
    const processedData = processNavigationData(navigationDataFallback as any)
    const filteredData = filterNavigationData(processedData)

    return NextResponse.json(filteredData, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json'
      }
    })
  }
}