'use client'

import { useState, useCallback } from 'react'
import type { LinkMetadata } from '@/lib/link-analysis'

interface UseFetchMetadataOptions {
    onSuccess?: (metadata: LinkMetadata) => void
    onError?: (error: Error) => void
}

interface UseFetchMetadataReturn {
    fetchMetadata: (url: string) => Promise<LinkMetadata | null>
    isLoading: boolean
    error: string | null
}

export function isValidUrl(string: string): boolean {
    try {
        new URL(string)
        return true
    } catch {
        return false
    }
}

export function useFetchMetadata(options: UseFetchMetadataOptions = {}): UseFetchMetadataReturn {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchMetadata = useCallback(async (url: string): Promise<LinkMetadata | null> => {
        if (!url || !isValidUrl(url)) {
            setError('请输入有效的URL')
            return null
        }

        if (isLoading) return null

        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/website-metadata', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            })

            if (!response.ok) {
                throw new Error('获取网站信息失败')
            }

            const metadata: LinkMetadata = await response.json()
            options.onSuccess?.(metadata)
            return metadata
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '获取网站信息失败'
            setError(errorMessage)
            options.onError?.(err instanceof Error ? err : new Error(errorMessage))
            return null
        } finally {
            setIsLoading(false)
        }
    }, [isLoading, options])

    return {
        fetchMetadata,
        isLoading,
        error,
    }
}
