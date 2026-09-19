/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Deployed behind Mel; keep output standard (no static export) since
  // /api routes (SSE, state mutation) need a Node runtime.
};

export default nextConfig;
