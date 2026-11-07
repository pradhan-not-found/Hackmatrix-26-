/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets a production test build live beside `next dev` without clobbering it.
  distDir: process.env.NEXT_DIST_DIR || '.next',
}

export default nextConfig
