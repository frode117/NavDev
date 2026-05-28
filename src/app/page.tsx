import { Metadata } from 'next/types'
import { ScrollToTop } from '@/components/ScrollToTop'
import { Container } from '@/components/ui/container'
import type { NavigationData } from '@/types/navigation'
import { kvGet, KV_KEYS } from '@/lib/storage'
import navigationDataFallback from '@/navdev/content/navigation.json'
import siteDataFallback from '@/navdev/content/site.json'
import { HomePageClient } from '@/components/home-page-client'

import { processSiteData, processNavigationData, filterNavigationData } from '@/lib/data-loader'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

async function getData() {
  try {
    const [navData, siteData] = await Promise.all([
      kvGet<NavigationData>(KV_KEYS.NAVIGATION),
      kvGet<typeof siteDataFallback>(KV_KEYS.SITE_CONFIG)
    ])

    const rawNavData = navData || navigationDataFallback
    const rawSiteData = siteData || siteDataFallback

    const processedSiteData = processSiteData(rawSiteData as any)
    const processedNavData = processNavigationData(rawNavData as any)
    const filteredNavData = filterNavigationData(processedNavData)

    return {
      siteData: processedSiteData,
      navigationData: filteredNavData
    }
  } catch (error) {
    console.error('Error fetching data:', error)
    const processedSiteData = processSiteData(siteDataFallback as any)
    const processedNavData = processNavigationData(navigationDataFallback as any)
    const filteredNavData = filterNavigationData(processedNavData)

    return {
      siteData: processedSiteData,
      navigationData: filteredNavData
    }
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { siteData } = await getData()

  return {
    title: siteData.basic.title,
    description: siteData.basic.description,
    keywords: siteData.basic.keywords,
    icons: {
      icon: siteData.appearance.favicon,
    },
  }
}

export default async function HomePage() {
  const { navigationData, siteData } = await getData()

  return (
    <Container>
      <HomePageClient
        initialNavigationData={navigationData}
        initialSiteData={siteData}
      />
      <ScrollToTop />
    </Container>
  )
}
