import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayoutClient } from './AdminLayoutClient'
import { Toaster } from "@/registry/new-york/ui/toaster"
import { Metadata } from 'next'
import { kvGet, KV_KEYS } from '@/lib/storage'
import siteDataFallback from '@/navdev/content/site.json'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  try {
    const siteData = await kvGet<typeof siteDataFallback>(KV_KEYS.SITE_CONFIG) || siteDataFallback

    return {
      title: `${siteData.basic.title || 'NavDev'} Admin`,
      description: `${siteData.basic.title || 'NavDev'} Admin Dashboard`,
      icons: {
        icon: siteData.appearance.favicon || '/favicon.ico',
        shortcut: siteData.appearance.favicon || '/favicon.ico',
        apple: siteData.appearance.favicon || '/favicon.ico',
      }
    }
  } catch (error) {
    console.error('Error loading site config for metadata:', error)
    return {
      title: 'NavDev Admin',
      description: 'NavDev Admin Dashboard',
      icons: {
        icon: '/favicon.ico',
      }
    }
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // 获取站点配置用于logo
  const siteData = await kvGet<typeof siteDataFallback>(KV_KEYS.SITE_CONFIG) || siteDataFallback

  return (
    <>
      <AdminLayoutClient
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image
        }}
        logoUrl={siteData.appearance.logo || '/assets/images/alogo.webp'}
      >
        {children}
      </AdminLayoutClient>
      <Toaster />
    </>
  )
} 