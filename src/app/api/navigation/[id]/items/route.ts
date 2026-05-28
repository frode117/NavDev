import { createItemsRouteHandlers, navigationService } from '@/lib/api-utils'

export const runtime = 'edge'

const handlers = createItemsRouteHandlers(navigationService)

export const GET = handlers.GET
export const POST = handlers.POST
export const PUT = handlers.PUT
export const DELETE = handlers.DELETE
