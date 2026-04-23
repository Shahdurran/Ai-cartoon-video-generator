/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces the minimal runtime image for Railway's Docker deployment.
  output: 'standalone',
  reactStrictMode: true,

  // Allow remote images from Cloudflare R2 if the user exposes a CDN base URL.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.cloudflare.com' },
    ],
  },

  // When backend and frontend share a Railway private network, rewrites let
  // us keep the backend internal and route through the Next.js origin.
  async rewrites() {
    const backend = process.env.BACKEND_INTERNAL_URL;
    if (!backend) return [];
    return [
      {
        source: '/backend-api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
