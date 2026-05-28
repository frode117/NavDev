'use client'

import { ItemCard, navigationCardConfig } from '@/components/shared/item-card'
import { NavigationItem } from '@/types/navigation'

interface NavigationCardProps {
    item: NavigationItem
    index: number
    onUpdate: () => void
    onMoveToTop?: () => void
    onMoveToBottom?: () => void
    showMoveToTop?: boolean
    showMoveToBottom?: boolean
}

export function NavigationCard(props: NavigationCardProps) {
    return <ItemCard {...props} config={navigationCardConfig} />
}
