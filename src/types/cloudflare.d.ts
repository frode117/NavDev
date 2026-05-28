declare module '@cloudflare/next-on-pages' {
  export function getRequestContext<E = CloudflareEnv>(): { env: E; ctx: ExecutionContext; cf: CfProperties }
}

export interface CloudflareEnv {
  NAVDEV_KV: KVNamespace
  NAVDEV_R2: R2Bucket
  R2_PUBLIC_URL?: string
}

export interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<string | object | ArrayBuffer | ReadableStream | null>
  put(key: string, value: string | ReadableStream | ArrayBuffer, options?: KVPutOptions): Promise<void>
  delete(key: string): Promise<void>
  list(options?: KVListOptions): Promise<KVListResult>
}

interface KVPutOptions {
  expiration?: number
  expirationTtl?: number
  metadata?: Record<string, unknown>
}

interface KVListOptions {
  prefix?: string
  limit?: number
  cursor?: string
}

interface KVListResult {
  keys: Array<{ name: string; expiration?: number; metadata?: Record<string, unknown> }>
  list_complete: boolean
  cursor?: string
}

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: R2PutOptions): Promise<R2Object>
  delete(key: string | string[]): Promise<void>
  list(options?: R2ListOptions): Promise<R2Objects>
  head(key: string): Promise<R2Object | null>
}

export interface R2Object {
  key: string
  version: string
  size: number
  etag: string
  httpEtag: string
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
  uploaded: Date
  body: ReadableStream
  bodyUsed: boolean
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json<T>(): Promise<T>
  blob(): Promise<Blob>
}

interface R2HTTPMetadata {
  contentType?: string
  contentLanguage?: string
  contentDisposition?: string
  contentEncoding?: string
  cacheControl?: string
  cacheExpiry?: Date
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
  md5?: ArrayBuffer | string
  sha1?: ArrayBuffer | string
  sha256?: ArrayBuffer | string
  sha384?: ArrayBuffer | string
  sha512?: ArrayBuffer | string
}

interface R2ListOptions {
  prefix?: string
  limit?: number
  cursor?: string
  delimiter?: string
  include?: ('httpMetadata' | 'customMetadata')[]
}

interface R2Objects {
  objects: R2Object[]
  truncated: boolean
  cursor?: string
  delimitedPrefixes: string[]
}

declare global {
  interface RequestContext {
    env: CloudflareEnv
  }
}
