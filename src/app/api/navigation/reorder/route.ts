import { createReorderRouteHandler, navigationService } from '@/lib/api-utils'

export const runtime = 'edge'

export const POST = createReorderRouteHandler(navigationService, 'navigation')
