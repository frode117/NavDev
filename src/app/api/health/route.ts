import { NextResponse } from 'next/server'
export const runtime = 'edge'

export async function GET() {
  return NextResponse.json({
    app: 'NavDev',
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
}