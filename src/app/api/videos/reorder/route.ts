import { createReorderRouteHandler, videosService } from '@/lib/api-utils'

export const runtime = 'edge'

export const POST = createReorderRouteHandler(videosService, 'videos')
