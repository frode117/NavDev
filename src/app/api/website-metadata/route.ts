import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fetchLinkMetadata } from '@/lib/link-analysis'

export const runtime = 'edge'

function isValidUrl(string: string): boolean {
    try {
        new URL(string)
        return true
    } catch (_) {
        return false
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) {
            return new Response('Unauthorized', { status: 401 })
        }

        const { url } = await request.json()

        if (!url || !isValidUrl(url)) {
            return NextResponse.json({ error: '请提供有效的网站链接' }, { status: 400 })
        }

        const metadata = await fetchLinkMetadata(url, { downloadAssets: true })

        if (!metadata || typeof metadata !== 'object') {
            throw new Error('Failed to fetch valid metadata')
        }

        return NextResponse.json(metadata)
    } catch (error) {
        console.error('Failed to fetch website metadata:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '获取网站信息失败' },
            { status: 500 }
        )
    }
}
