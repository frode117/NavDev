import { createItemsRouteHandlers, videosService } from '@/lib/api-utils'

export const runtime = 'edge'

const handlers = createItemsRouteHandlers(videosService)

export const GET = handlers.GET
export const POST = handlers.POST
export const PUT = handlers.PUT
export const DELETE = handlers.DELETE
