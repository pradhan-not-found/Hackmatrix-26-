import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'

/** @type {import("next").NextConfigFunction} */
const nextConfig = (phase) => ({
  reactStrictMode: true,
  // Lets a production test build live beside `next dev` without clobbering it.
  distDir: process.env.NEXT_DIST_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next'),
  async rewrites() {
    const backend = (process.env.WEBASSURE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
    return [{ source: '/api/email/:path*', destination: `${backend}/api/email/:path*` }]
  },
})

export default nextConfig
