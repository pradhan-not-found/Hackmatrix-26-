import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'

/** @type {import("next").NextConfigFunction} */
const nextConfig = (phase) => ({
  reactStrictMode: true,
  // Lets a production test build live beside `next dev` without clobbering it.
  distDir: process.env.NEXT_DIST_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next'),
})

export default nextConfig
