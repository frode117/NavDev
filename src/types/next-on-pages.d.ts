declare module '@cloudflare/next-on-pages' {
  interface RequestContext<E = unknown> {
    env: E
    ctx: ExecutionContext
    cf: CfProperties
  }

  export function getRequestContext<E = unknown>(): RequestContext<E>
}
