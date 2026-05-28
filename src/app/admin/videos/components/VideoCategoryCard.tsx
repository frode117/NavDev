'use client'

import { ItemCard, videoCategoryCardConfig } from '@/components/shared/item-card'
import { NavigationItem } from '@/types/navigation'

interface VideoCategoryCardProps {
    item: NavigationItem
    index: number
    onUpdate: () => void
    onMoveToTop?: () => void
    onMoveToBottom?: () => void
    showMoveToTop?: boolean
    showMoveToBottom?: boolean
}

export function VideoCategoryCard(props: VideoCategoryCardProps) {
    return <ItemCard {...props} config={videoCategoryCardConfig} />
}
