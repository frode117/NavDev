import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { r2Upload, getMimeType } from '@/lib/storage'

export const runtime = 'edge'

interface VideoConfig {
    type: 'bilibili' | 'youtube'
    videoId?: string
    bvid?: string
    aid?: string
    cid?: string
    p?: number
}

interface WebsiteMetadata {
    title: string
    description: string
    icon: string
    image?: string
    videoConfig?: VideoConfig
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

        const metadata = await fetchWebsiteMetadata(url)

        if (!metadata || typeof metadata !== 'object') {
            throw new Error('Failed to fetch valid metadata')
        }

        // 处理封面/OG图片
        if (metadata.image) {
            try {
                const imageUrl = await downloadAndUploadIcon(
                    metadata.image,
                    url,
                    'cover',
                    'assets/cover'
                )
                metadata.image = imageUrl
            } catch (error) {
                console.warn('Failed to download image:', error)
            }
        }

        const isVideoUrl = extractBilibiliVideoId(url) !== null || extractYoutubeVideoId(url) !== null
        const skipFavicon = isVideoUrl && metadata.image

        if (metadata.icon && !skipFavicon) {
            try {
                const iconUrl = await downloadAndUploadIcon(metadata.icon, url, 'favicon')
                metadata.icon = iconUrl
            } catch (error) {
                console.warn('Failed to download icon:', error)
                try {
                    const domain = new URL(url).hostname
                    const fallbackIconUrl = await downloadGoogleFavicon(domain)
                    metadata.icon = fallbackIconUrl
                } catch (fallbackError) {
                    console.warn('Failed to download Google favicon:', fallbackError)
                }
            }
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

function isValidUrl(string: string): boolean {
    try {
        new URL(string)
        return true
    } catch (_) {
        return false
    }
}

function extractBilibiliVideoId(url: string): { bvid?: string; aid?: string } | null {
    try {
        const urlObj = new URL(url)
        if (!urlObj.hostname.includes('bilibili.com')) {
            return null
        }

        const bvidMatch = urlObj.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/)
        if (bvidMatch) {
            return { bvid: bvidMatch[1] }
        }

        const avidMatch = urlObj.pathname.match(/\/video\/av(\d+)/)
        if (avidMatch) {
            return { aid: avidMatch[1] }
        }

        return null
    } catch {
        return null
    }
}

function extractYoutubeVideoId(url: string): string | null {
    try {
        const urlObj = new URL(url)
        const hostname = urlObj.hostname

        if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) {
            return null
        }

        if (hostname.includes('youtu.be')) {
            return urlObj.pathname.slice(1).split('?')[0]
        }

        if (urlObj.pathname.includes('/watch')) {
            return urlObj.searchParams.get('v')
        }

        if (urlObj.pathname.includes('/embed/') || urlObj.pathname.includes('/v/')) {
            const match = urlObj.pathname.match(/\/(embed|v)\/([^/?]+)/)
            return match ? match[2] : null
        }

        if (urlObj.pathname.includes('/shorts/')) {
            const match = urlObj.pathname.match(/\/shorts\/([^/?]+)/)
            return match ? match[1] : null
        }

        return null
    } catch {
        return null
    }
}

function getYoutubeVideoInfo(videoId: string): WebsiteMetadata {
    return {
        title: '',
        description: '',
        icon: '/assets/icons/youtube.svg',
        image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        videoConfig: {
            type: 'youtube',
            videoId: videoId
        }
    }
}

async function fetchBilibiliVideoInfo(videoId: { bvid?: string; aid?: string }): Promise<WebsiteMetadata | null> {
    try {
        let apiUrl: string
        if (videoId.bvid) {
            apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${videoId.bvid}`
        } else if (videoId.aid) {
            apiUrl = `https://api.bilibili.com/x/web-interface/view?aid=${videoId.aid}`
        } else {
            return null
        }

        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com/'
            },
            signal: AbortSignal.timeout(5000)
        })

        if (!response.ok) {
            console.warn('Bilibili API request failed:', response.status)
            return null
        }

        const data = await response.json()

        if (data.code !== 0 || !data.data) {
            console.warn('Bilibili API returned error:', data.message)
            return null
        }

        const videoData = data.data
        const firstPage = videoData.pages?.[0]
        const cid = firstPage?.cid?.toString() || videoData.cid?.toString()

        return {
            title: videoData.title || '',
            description: videoData.desc || '',
            icon: '/assets/icons/bilibili.svg',
            image: videoData.pic || undefined,
            videoConfig: {
                type: 'bilibili',
                bvid: videoData.bvid,
                aid: videoData.aid?.toString(),
                cid: cid,
                p: 1
            }
        }
    } catch (error) {
        console.warn('Failed to fetch Bilibili video info:', error)
        return null
    }
}

async function fetchWebsiteMetadata(url: string): Promise<WebsiteMetadata> {
    try {
        // 优先检查Bilibili视频
        const bilibiliVideoId = extractBilibiliVideoId(url)
        if (bilibiliVideoId) {
            const bilibiliInfo = await fetchBilibiliVideoInfo(bilibiliVideoId)
            if (bilibiliInfo) {
                return bilibiliInfo
            }
        }

        // 检查YouTube视频
        const youtubeVideoId = extractYoutubeVideoId(url)
        if (youtubeVideoId) {
            const youtubeInfo = getYoutubeVideoInfo(youtubeVideoId)
            // 尝试获取YouTube页面的标题和描述
            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
                    },
                    signal: AbortSignal.timeout(5000)
                })
                if (response.ok) {
                    const html = await response.text()
                    const htmlMetadata = parseMetadataFromHtml(html, url)
                    youtubeInfo.title = htmlMetadata.title || youtubeInfo.title
                    youtubeInfo.description = htmlMetadata.description || youtubeInfo.description
                }
            } catch {
                // 忽略获取HTML失败的情况，使用默认值
            }
            return youtubeInfo
        }

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Cache-Control': 'max-age=0',
            'Sec-Ch-Ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }

        const response = await fetch(url, {
            headers: headers,
            redirect: 'follow',
            signal: AbortSignal.timeout(1500)
        })

        if (response.ok) {
            const html = await response.text()
            return parseMetadataFromHtml(html, url)
        } else if (response.status === 403) {
            console.warn(`网站拒绝访问 (403): 该网站可能阻止了自动化访问`)
            return getFallbackMetadata(url)
        } else if (response.status === 404) {
            return getFallbackMetadata(url)
        } else if (response.status >= 500) {
            return getFallbackMetadata(url)
        } else {
            console.warn(`无法访问网站: ${response.status}`)
            return getFallbackMetadata(url)
        }
    } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
            console.warn('请求超时，网站响应过慢')
        } else {
            console.warn('获取网站元数据失败:', error)
        }
        return getFallbackMetadata(url)
    }
}

function getFallbackMetadata(url: string): WebsiteMetadata {
    try {
        const urlObj = new URL(url)
        const hostname = urlObj.hostname
        const title = hostname.replace(/^www\./, '').split('.')[0]
        const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1)

        return {
            title: capitalizedTitle,
            description: `访问 ${hostname}`,
            icon: `https://www.google.com/s2/favicons?sz=128&domain=${hostname}`
        }
    } catch {
        return {
            title: '未知网站',
            description: '无法获取网站信息',
            icon: ''
        }
    }
}

function parseMetadataFromHtml(html: string, url: string): WebsiteMetadata {
    const title = extractMetaContent(html, 'title') ||
        extractMetaContent(html, 'og:title') ||
        extractMetaContent(html, 'twitter:title') ||
        new URL(url).hostname

    const description = extractMetaContent(html, 'description') ||
        extractMetaContent(html, 'og:description') ||
        extractMetaContent(html, 'twitter:description') ||
        ''

    const image = extractMetaContent(html, 'og:image') ||
        extractMetaContent(html, 'twitter:image') ||
        extractMetaContent(html, 'image')

    const icon = extractFavicon(html, url)

    return {
        title: title.trim(),
        description: description.trim(),
        icon: icon || '',
        image: image || undefined
    }
}

function extractMetaContent(html: string, name: string): string | null {
    if (name === 'title') {
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
        return titleMatch ? titleMatch[1] : null
    }

    const patterns = [
        new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i'),
        new RegExp(`<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${name}["']`, 'i'),
        new RegExp(`<meta[^>]*itemprop=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*itemprop=["']${name}["']`, 'i')
    ]

    for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match) {
            return match[1]
        }
    }

    return null
}

function extractFavicon(html: string, baseUrl: string): string | null {
    const base = new URL(baseUrl)

    const faviconPatterns = [
        /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']*)["']/i,
        /<link[^>]*href=["']([^"']*)["'][^>]*rel=["']icon["']/i,
        /<link[^>]*rel=["']shortcut icon["'][^>]*href=["']([^"']*)["']/i,
        /<link[^>]*href=["']([^"']*)["'][^>]*rel=["']shortcut icon["']/i,
        /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']*)["']/i,
        /<link[^>]*href=["']([^"']*)["'][^>]*rel=["']apple-touch-icon["']/i
    ]

    for (const pattern of faviconPatterns) {
        const match = html.match(pattern)
        if (match) {
            const href = match[1]
            if (href.startsWith('http')) {
                return href
            } else if (href.startsWith('//')) {
                return base.protocol + href
            } else if (href.startsWith('/')) {
                return base.origin + href
            } else {
                return base.origin + '/' + href
            }
        }
    }

    return `https://www.google.com/s2/favicons?sz=128&domain=${base.hostname}`
}

async function downloadGoogleFavicon(domain: string): Promise<string> {
    const googleFaviconUrl = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`

    try {
        const response = await fetch(googleFaviconUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                'Accept': 'image/*,*/*'
            },
            signal: AbortSignal.timeout(10000)
        })

        if (response.ok) {
            const arrayBuffer = await response.arrayBuffer()
            const binaryData = new Uint8Array(arrayBuffer)
            return uploadImageToR2(binaryData, 'png', 'favicon')
        } else {
            throw new Error(`Failed to download Google favicon: ${response.status}`)
        }
    } catch (error) {
        throw new Error(`Google favicon download failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

async function downloadAndUploadIcon(
    iconUrl: string,
    referer?: string,
    prefix: string = 'favicon',
    folder: string = 'assets'
): Promise<string> {
    const isBilibiliCdn = iconUrl.includes('hdslb.com') || iconUrl.includes('bilibili.com')

    const strategies: Array<{ headers: HeadersInit }> = []

    if (isBilibiliCdn) {
        strategies.push({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Referer': 'https://www.bilibili.com/',
                'Origin': 'https://www.bilibili.com'
            }
        })
    }

    strategies.push({
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Referer': referer || new URL(iconUrl).origin + '/',
            'Sec-Ch-Ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site'
        }
    })

    let lastError: Error | null = null

    for (const strategy of strategies) {
        try {
            const response = await fetch(iconUrl, {
                headers: strategy.headers,
                redirect: 'follow',
                signal: AbortSignal.timeout(15000)
            })

            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer()
                const binaryData = new Uint8Array(arrayBuffer)
                return uploadImageToR2(binaryData, getFileExtension(iconUrl), prefix, folder)
            } else {
                lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
                console.warn(`Strategy failed with status ${response.status}, trying next strategy...`)
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error')
            console.warn(`Strategy failed with error:`, error)
        }
    }

    throw lastError || new Error('All download strategies failed')
}

function getFileExtension(url: string): string {
    try {
        const pathname = new URL(url).pathname
        const extension = pathname.split('.').pop()?.toLowerCase()

        if (extension && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'].includes(extension)) {
            return extension
        }
        return 'png'
    } catch {
        return 'png'
    }
}

async function uploadImageToR2(
    binaryData: Uint8Array,
    extension: string = 'png',
    prefix: string = 'favicon',
    folder: string = 'assets'
): Promise<string> {
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '')
    const key = `${cleanFolder}/${prefix}_${Date.now()}.${extension}`
    const contentType = getMimeType(`file.${extension}`)
    return r2Upload(key, binaryData, contentType)
}
