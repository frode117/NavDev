import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { kvGet, kvSet, KV_KEYS } from '@/lib/storage'
import type { NavigationData, NavigationSubItem, NavigationItem } from '@/types/navigation'

type KVKeyType = typeof KV_KEYS.NAVIGATION | typeof KV_KEYS.VIDEOS

export type RouteHandler = (
    request: Request,
    context: { params: Promise<{ id?: string }> }
) => Promise<Response>

export type AuthenticatedHandler = (
    request: Request,
    context: { params: Promise<{ id?: string }> },
    session: { user: { name?: string | null } }
) => Promise<Response>

export function withAuth(handler: AuthenticatedHandler): RouteHandler {
    return async (request, context) => {
        const session = await auth()
        if (!session?.user) {
            return new Response('Unauthorized', { status: 401 })
        }
        return handler(request, context, session)
    }
}

export function createDataService(kvKey: KVKeyType) {
    const getData = async (): Promise<NavigationData> => {
        const data = await kvGet<NavigationData>(kvKey)
        return data || { navigationItems: [] }
    }

    const saveData = async (data: NavigationData): Promise<void> => {
        await kvSet(kvKey, data)
    }

    const findItemById = async (id: string): Promise<NavigationItem | undefined> => {
        const data = await getData()
        return data.navigationItems.find(item => item.id === id)
    }

    const updateItems = async (
        id: string,
        updater: (items: NavigationSubItem[]) => NavigationSubItem[]
    ): Promise<void> => {
        const data = await getData()
        const updatedNavigations = data.navigationItems.map(nav => {
            if (nav.id === id) {
                return {
                    ...nav,
                    items: updater(nav.items || [])
                }
            }
            return nav
        })
        await saveData({ navigationItems: updatedNavigations })
    }

    const reorderNavigationItems = async (
        sourceIndex: number,
        destinationIndex: number
    ): Promise<NavigationItem[]> => {
        const data = await getData()
        if (!data.navigationItems || !Array.isArray(data.navigationItems)) {
            throw new Error('Invalid data')
        }
        const updatedItems = [...data.navigationItems]
        const [movedItem] = updatedItems.splice(sourceIndex, 1)
        updatedItems.splice(destinationIndex, 0, movedItem)
        await saveData({ navigationItems: updatedItems })
        return updatedItems
    }

    return {
        getData,
        saveData,
        findItemById,
        updateItems,
        reorderNavigationItems
    }
}

export const navigationService = createDataService(KV_KEYS.NAVIGATION)
export const videosService = createDataService(KV_KEYS.VIDEOS)

export function createItemsRouteHandlers(service: ReturnType<typeof createDataService>) {
    const GET: RouteHandler = async (request, { params }) => {
        try {
            const { id } = await params
            if (!id) {
                return NextResponse.json({ error: 'ID is required' }, { status: 400 })
            }
            const item = await service.findItemById(id)
            if (!item) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }
            return NextResponse.json(item.items)
        } catch {
            return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
        }
    }

    const POST: RouteHandler = withAuth(async (request, { params }) => {
        try {
            const { id } = await params
            if (!id) {
                return NextResponse.json({ error: 'ID is required' }, { status: 400 })
            }
            const newItem: NavigationSubItem = await request.json()
            await service.updateItems(id, items => [...items, newItem])
            return NextResponse.json({ success: true })
        } catch {
            return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
        }
    })

    const PUT: RouteHandler = withAuth(async (request, { params }) => {
        try {
            const { id } = await params
            if (!id) {
                return NextResponse.json({ error: 'ID is required' }, { status: 400 })
            }
            const item = await service.findItemById(id)
            if (!item) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }
            const { index, item: updatedItem }: { index: number; item: NavigationSubItem } = await request.json()
            await service.updateItems(id, items => {
                const newItems = [...items]
                newItems[index] = updatedItem
                return newItems
            })
            return NextResponse.json({ success: true })
        } catch {
            return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
        }
    })

    const DELETE: RouteHandler = withAuth(async (request, { params }) => {
        try {
            const { id } = await params
            if (!id) {
                return NextResponse.json({ error: 'ID is required' }, { status: 400 })
            }
            const item = await service.findItemById(id)
            if (!item) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }
            const { index } = await request.json()
            await service.updateItems(id, items => items.filter((_, i) => i !== index))
            return NextResponse.json({ success: true })
        } catch {
            return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
        }
    })

    return { GET, POST, PUT, DELETE }
}

export function createReorderRouteHandler(
    service: ReturnType<typeof createDataService>,
    entityName: string
) {
    return withAuth(async (request) => {
        try {
            const { sourceIndex, destinationIndex } = await request.json()
            const updatedItems = await service.reorderNavigationItems(sourceIndex, destinationIndex)
            return NextResponse.json(updatedItems, { status: 200 })
        } catch (error) {
            console.error(`Reorder ${entityName} error:`, error)
            return NextResponse.json({
                error: `Failed to reorder ${entityName}`,
                details: (error as Error).message
            }, { status: 500 })
        }
    })
}
