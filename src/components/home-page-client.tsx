'use client'

import useSWR from 'swr'
import type { NavigationData } from '@/types/navigation'
import type { SiteConfig } from '@/types/site'
import { NavigationContent } from '@/components/navigation-content'
import { Skeleton } from "@/registry/new-york/ui/skeleton"

interface HomePageClientProps {
  initialNavigationData: NavigationData
  initialSiteData: SiteConfig
}

async function fetchNavigation(): Promise<NavigationData> {
  const res = await fetch('/api/home/navigation')
  if (!res.ok) throw new Error('Failed to fetch navigation')
  return res.json()
}

async function fetchSiteConfig(): Promise<SiteConfig> {
  const res = await fetch('/api/home/site')
  if (!res.ok) throw new Error('Failed to fetch site config')
  return res.json()
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row min-h-screen">
      <div className="hidden sm:block w-64 p-4 border-r">
        <Skeleton className="h-8 w-32 mb-4" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-6 w-full mb-2" />
        ))}
      </div>
      <main className="flex-1 p-6">
        <Skeleton className="h-10 w-full max-w-md mb-6" />
        <div className="space-y-6">
          {[1, 2].map((section) => (
            <div key={section}>
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export function HomePageClient({ initialNavigationData, initialSiteData }: HomePageClientProps) {
  const { data: navigationData, isLoading: navLoading } = useSWR<NavigationData>(
    'home-navigation',
    fetchNavigation,
    {
      fallbackData: initialNavigationData,
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  )

  const { data: siteData, isLoading: siteLoading } = useSWR<SiteConfig>(
    'home-site-config',
    fetchSiteConfig,
    {
      fallbackData: initialSiteData,
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  )

  if ((navLoading && !navigationData) || (siteLoading && !siteData)) {
    return <LoadingSkeleton />
  }

  return (
    <NavigationContent
      navigationData={navigationData || initialNavigationData}
      siteData={siteData || initialSiteData}
    />
  )
}
