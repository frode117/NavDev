import { r2Upload, getMimeType } from '@/lib/storage'

export interface VideoConfig {
    type: 'bilibili' | 'youtube'
    videoId?: string
    bvid?: string
    aid?: string
    cid?: string
    p?: number
}

export interface LinkMetadata {
    title: string
    description: string
    icon: string
    image?: string
    videoConfig?: VideoConfig
}

export interface LinkAnalysisOptions {
    downloadAssets?: boolean
    timeout?: number
}

// AI Integration Architecture (Future Enhancement)
// ================================================
// export interface AIEnhancedOptions extends LinkAnalysisOptions {
//     ai?: {
//         enabled: boolean
//         provider: 'openai' | 'anthropic' | 'local'
//         features: { summarize?: boolean; categorize?: boolean; extractTags?: boolean }
//     }
// }
// export interface AIEnhancedMetadata extends LinkMetadata {
//     aiSummary?: string
//     suggestedCategories?: string[]
//     tags?: string[]
// }

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export function extractBilibiliVideoId(url: string): { bvid?: string; aid?: string } | null {
    try {
        const urlObj = new URL(url)
        if (!urlObj.hostname.includes('bilibili.com')) return null

        const bvidMatch = urlObj.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/)
        if (bvidMatch) return { bvid: bvidMatch[1] }

        const avidMatch = urlObj.pathname.match(/\/video\/av(\d+)/)
        if (avidMatch) return { aid: avidMatch[1] }

        return null
    } catch {
        return null
    }
}

export function extractYoutubeVideoId(url: string): string | null {
    try {
        const urlObj = new URL(url)
        const hostname = urlObj.hostname

        if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) return null

        if (hostname.includes('youtu.be')) return urlObj.pathname.slice(1).split('?')[0]
        if (urlObj.pathname.includes('/watch')) return urlObj.searchParams.get('v')
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

export function isVideoUrl(url: string): boolean {
    return extractBilibiliVideoId(url) !== null || extractYoutubeVideoId(url) !== null
}

// Decode common HTML entities in attribute values
function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

// Separate patterns for double-quoted and single-quoted attribute values
// to avoid the bug where [^"'] truncates content containing apostrophes
function extractMetaContent(html: string, name: string): string | null {
    if (name === 'title') {
        // Use [\s\S]*? to handle multiline titles
        const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        return match ? decodeHtmlEntities(match[1].trim()) : null
    }

    // Escape special regex characters in the name (e.g. og:title has a colon)
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(':', '\\:')

    const patterns = [
        // Double-quoted content with name/property/itemprop attributes (both attribute orders)
        new RegExp(`<meta[^>]+name=["']${escapedName}["'][^>]+content="([^"]*)"`, 'i'),
        new RegExp(`<meta[^>]+content="([^"]*)"[^>]+name=["']${escapedName}["']`, 'i'),
        new RegExp(`<meta[^>]+property=["']${escapedName}["'][^>]+content="([^"]*)"`, 'i'),
        new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property=["']${escapedName}["']`, 'i'),
        new RegExp(`<meta[^>]+itemprop=["']${escapedName}["'][^>]+content="([^"]*)"`, 'i'),
        new RegExp(`<meta[^>]+content="([^"]*)"[^>]+itemprop=["']${escapedName}["']`, 'i'),
        // Single-quoted content (handles content containing double-quotes)
        new RegExp(`<meta[^>]+name=["']${escapedName}["'][^>]+content='([^']*)'`, 'i'),
        new RegExp(`<meta[^>]+content='([^']*)'[^>]+name=["']${escapedName}["']`, 'i'),
        new RegExp(`<meta[^>]+property=["']${escapedName}["'][^>]+content='([^']*)'`, 'i'),
        new RegExp(`<meta[^>]+content='([^']*)'[^>]+property=["']${escapedName}["']`, 'i'),
    ]

    for (const pattern of patterns) {
        const match = html.match(pattern)
        if (match?.[1] !== undefined) {
            return decodeHtmlEntities(match[1].trim())
        }
    }

    return null
}

function extractFavicon(html: string, baseUrl: string): string | null {
    const base = new URL(baseUrl)

    const faviconPatterns = [
        /<link[^>]*rel=["']icon["'][^>]*href="([^"]*)"/i,
        /<link[^>]*href="([^"]*)"[^>]*rel=["']icon["']/i,
        /<link[^>]*rel=["']shortcut icon["'][^>]*href="([^"]*)"/i,
        /<link[^>]*href="([^"]*)"[^>]*rel=["']shortcut icon["']/i,
        /<link[^>]*rel=["']apple-touch-icon["'][^>]*href="([^"]*)"/i,
        /<link[^>]*href="([^"]*)"[^>]*rel=["']apple-touch-icon["']/i,
        // Single-quoted variants
        /<link[^>]*rel=["']icon["'][^>]*href='([^']*)'/i,
        /<link[^>]*href='([^']*)'[^>]*rel=["']icon["']/i,
    ]

    for (const pattern of faviconPatterns) {
        const match = html.match(pattern)
        if (match) {
            const href = match[1]
            if (href.startsWith('http')) return href
            if (href.startsWith('//')) return base.protocol + href
            if (href.startsWith('/')) return base.origin + href
            return base.origin + '/' + href
        }
    }

    return `https://www.google.com/s2/favicons?sz=128&domain=${base.hostname}`
}

function parseMetadataFromHtml(html: string, url: string): LinkMetadata {
    // Try <title> first, then og:title for more descriptive titles
    const rawTitle = extractMetaContent(html, 'og:title') ||
        extractMetaContent(html, 'title') ||
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
        title: rawTitle.trim(),
        description: description.trim(),
        icon: icon || '',
        image: image || undefined
    }
}

function getFallbackMetadata(url: string): LinkMetadata {
    try {
        const urlObj = new URL(url)
        const hostname = urlObj.hostname
        const title = hostname.replace(/^www\./, '').split('.')[0]
        return {
            title: title.charAt(0).toUpperCase() + title.slice(1),
            description: `访问 ${hostname}`,
            icon: `https://www.google.com/s2/favicons?sz=128&domain=${hostname}`
        }
    } catch {
        return { title: '未知网站', description: '无法获取网站信息', icon: '' }
    }
}

// Bilibili API — requires Wbi signing since mid-2023, often returns -352 without it.
// We try the API first (works for some requests) then fall back to page scraping.
async function fetchBilibiliVideoInfo(videoId: { bvid?: string; aid?: string }): Promise<LinkMetadata | null> {
    const { bvid, aid } = videoId
    if (!bvid && !aid) return null

    // Attempt 1: official API
    try {
        const apiUrl = bvid
            ? `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
            : `https://api.bilibili.com/x/web-interface/view?aid=${aid}`

        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': BROWSER_UA,
                'Referer': 'https://www.bilibili.com/',
                'Origin': 'https://www.bilibili.com'
            },
            signal: AbortSignal.timeout(5000)
        })

        if (response.ok) {
            const data = await response.json()
            if (data.code === 0 && data.data) {
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
                        cid,
                        p: 1
                    }
                }
            }
            console.warn('Bilibili API error:', data.code, data.message)
        }
    } catch (error) {
        console.warn('Bilibili API fetch failed:', error)
    }

    // Attempt 2: page scraping fallback (Bilibili serves og: tags server-side)
    try {
        const pageUrl = bvid
            ? `https://www.bilibili.com/video/${bvid}`
            : `https://www.bilibili.com/video/av${aid}`

        const response = await fetch(pageUrl, {
            headers: {
                'User-Agent': BROWSER_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Referer': 'https://www.bilibili.com/',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000)
        })

        if (response.ok) {
            const html = await response.text()
            const title = extractMetaContent(html, 'og:title') ||
                // Strip " - 哔哩哔哩" suffix from <title> tag
                extractMetaContent(html, 'title')?.replace(/\s*[-_]\s*哔哩哔哩.*$/i, '').trim()
            const description = extractMetaContent(html, 'og:description') ||
                extractMetaContent(html, 'description')
            const image = extractMetaContent(html, 'og:image')

            if (title) {
                return {
                    title,
                    description: description || '',
                    icon: '/assets/icons/bilibili.svg',
                    image: image || undefined,
                    videoConfig: { type: 'bilibili', bvid, aid }
                }
            }
        }
    } catch (error) {
        console.warn('Bilibili page scraping failed:', error)
    }

    return null
}

// YouTube: oEmbed gives reliable title; page scraping gives description.
async function fetchYoutubeVideoInfo(videoId: string, videoUrl: string): Promise<LinkMetadata> {
    const base: LinkMetadata = {
        title: '',
        description: '',
        icon: '/assets/icons/youtube.svg',
        image: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        videoConfig: { type: 'youtube', videoId }
    }

    // Attempt 1: oEmbed API — most reliable for title
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`
        const response = await fetch(oembedUrl, {
            headers: { 'User-Agent': BROWSER_UA },
            signal: AbortSignal.timeout(5000)
        })
        if (response.ok) {
            const data = await response.json()
            if (data.title) base.title = data.title
        }
    } catch {
        // oEmbed failed, will try page scraping below
    }

    // Attempt 2: page scraping for description (and title if oEmbed failed)
    try {
        const response = await fetch(videoUrl, {
            headers: {
                'User-Agent': BROWSER_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                // Use English to get predictable HTML structure from YouTube
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(8000)
        })
        if (response.ok) {
            const html = await response.text()
            const title = extractMetaContent(html, 'og:title') || extractMetaContent(html, 'title')
            const description = extractMetaContent(html, 'og:description') ||
                extractMetaContent(html, 'description')
            if (!base.title && title) base.title = title
            if (description) base.description = description
        }
    } catch {
        // page scraping failed — use what we have from oEmbed
    }

    return base
}

async function downloadGoogleFavicon(domain: string): Promise<string> {
    const googleFaviconUrl = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`
    const response = await fetch(googleFaviconUrl, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept': 'image/*,*/*' },
        signal: AbortSignal.timeout(10000)
    })
    if (!response.ok) throw new Error(`Failed to download Google favicon: ${response.status}`)
    const binaryData = new Uint8Array(await response.arrayBuffer())
    return uploadImageToR2(binaryData, 'png', 'favicon')
}

async function downloadAndUploadAsset(
    assetUrl: string,
    referer?: string,
    prefix: string = 'favicon',
    folder: string = 'assets'
): Promise<string> {
    const isBilibiliCdn = assetUrl.includes('hdslb.com') || assetUrl.includes('bilibili.com')

    const strategies: Array<{ headers: HeadersInit }> = []

    if (isBilibiliCdn) {
        strategies.push({
            headers: {
                'User-Agent': BROWSER_UA,
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Referer': 'https://www.bilibili.com/',
                'Origin': 'https://www.bilibili.com'
            }
        })
    }

    strategies.push({
        headers: {
            'User-Agent': BROWSER_UA,
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': referer || new URL(assetUrl).origin + '/',
        }
    })

    let lastError: Error | null = null

    for (const strategy of strategies) {
        try {
            const response = await fetch(assetUrl, {
                headers: strategy.headers,
                redirect: 'follow',
                signal: AbortSignal.timeout(15000)
            })

            if (response.ok) {
                const binaryData = new Uint8Array(await response.arrayBuffer())
                return uploadImageToR2(binaryData, getFileExtension(assetUrl), prefix, folder)
            }
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
            console.warn(`Asset download failed: ${response.status}`)
        } catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error')
            console.warn('Asset download error:', error)
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
    return r2Upload(key, binaryData, getMimeType(`file.${extension}`))
}

export async function fetchLinkMetadata(
    url: string,
    options: LinkAnalysisOptions = {}
): Promise<LinkMetadata> {
    const { downloadAssets = true, timeout = 8000 } = options

    try {
        // Bilibili video
        const bilibiliVideoId = extractBilibiliVideoId(url)
        if (bilibiliVideoId) {
            const info = await fetchBilibiliVideoInfo(bilibiliVideoId)
            if (info) {
                if (downloadAssets && info.image) {
                    try {
                        info.image = await downloadAndUploadAsset(info.image, url, 'cover', 'assets/cover')
                    } catch (error) {
                        console.warn('Failed to download Bilibili cover:', error)
                    }
                }
                return info
            }
        }

        // YouTube video
        const youtubeVideoId = extractYoutubeVideoId(url)
        if (youtubeVideoId) {
            const info = await fetchYoutubeVideoInfo(youtubeVideoId, url)
            if (downloadAssets && info.image) {
                try {
                    info.image = await downloadAndUploadAsset(info.image, url, 'cover', 'assets/cover')
                } catch (error) {
                    console.warn('Failed to download YouTube cover:', error)
                }
            }
            return info
        }

        // General website
        const response = await fetch(url, {
            headers: {
                'User-Agent': BROWSER_UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Upgrade-Insecure-Requests': '1',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(timeout)
        })

        let metadata: LinkMetadata

        if (response.ok) {
            const html = await response.text()
            metadata = parseMetadataFromHtml(html, url)
        } else {
            console.warn(`Website returned ${response.status}`)
            metadata = getFallbackMetadata(url)
        }

        if (downloadAssets) {
            // Download og:image / cover
            if (metadata.image) {
                try {
                    metadata.image = await downloadAndUploadAsset(metadata.image, url, 'cover', 'assets/cover')
                } catch (error) {
                    console.warn('Failed to download cover image:', error)
                }
            }

            // Download favicon
            if (metadata.icon) {
                try {
                    metadata.icon = await downloadAndUploadAsset(metadata.icon, url, 'favicon')
                } catch {
                    try {
                        metadata.icon = await downloadGoogleFavicon(new URL(url).hostname)
                    } catch {
                        console.warn('Failed to download favicon, using Google fallback URL')
                        metadata.icon = `https://www.google.com/s2/favicons?sz=128&domain=${new URL(url).hostname}`
                    }
                }
            }
        }

        return metadata
    } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
            console.warn('Request timeout for:', url)
        } else {
            console.warn('Failed to fetch link metadata:', error)
        }
        return getFallbackMetadata(url)
    }
}

export { downloadAndUploadAsset, downloadGoogleFavicon }
