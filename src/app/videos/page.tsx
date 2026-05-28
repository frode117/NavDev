import { VideoContent } from '@/components/video-content'
import { Metadata } from 'next/types'
import { ScrollToTop } from '@/components/ScrollToTop'
import { Container } from '@/components/ui/container'
import type { NavigationData } from '@/types/navigation'
import { kvGet, KV_KEYS } from '@/lib/storage'
import videosDataFallback from '@/navdev/content/videos.json'
import siteDataFallback from '@/navdev/content/site.json'
import { processSiteData, processNavigationData, filterNavigationData } from '@/lib/data-loader'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

async function getData() {
    try {
        const [videoData, siteData] = await Promise.all([
            kvGet<NavigationData>(KV_KEYS.VIDEOS),
            kvGet<typeof siteDataFallback>(KV_KEYS.SITE_CONFIG)
        ])

        const rawVideoData = videoData || videosDataFallback
        const rawSiteData = siteData || siteDataFallback

        const processedSiteData = processSiteData(rawSiteData as any)
        const processedVideoData = processNavigationData(rawVideoData as any)
        const filteredVideoData = filterNavigationData(processedVideoData)

        return {
            siteData: processedSiteData,
            navigationData: filteredVideoData
        }
    } catch (error) {
        console.error('Error fetching video data:', error)
        const processedSiteData = processSiteData(siteDataFallback as any)
        const processedVideoData = processNavigationData(videosDataFallback as any)
        const filteredVideoData = filterNavigationData(processedVideoData)

        return {
            siteData: processedSiteData,
            navigationData: filteredVideoData
        }
    }
}

export async function generateMetadata(): Promise<Metadata> {
    const { siteData } = await getData()

    return {
        title: `Videos - ${siteData.basic.title}`,
        description: 'Video Navigation',
        keywords: 'Bilibili, YouTube, Videos',
        icons: {
            icon: siteData.appearance.favicon,
        },
    }
}

export default async function VideosPage() {
    const { navigationData, siteData } = await getData()

    return (
        <Container>
            <VideoContent navigationData={navigationData} siteData={siteData} />
            <ScrollToTop />
        </Container>
    )
}
