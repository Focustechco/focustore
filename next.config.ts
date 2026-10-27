import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate automated servers/builds from an already running developer server.
  distDir: process.env.FOCUS_TEST_DIST_DIR || '.next',
  typescript: { tsconfigPath: process.env.FOCUS_TEST_TSCONFIG || 'tsconfig.json' },
  reactStrictMode: true,
  cacheComponents: false,
  serverExternalPackages: ['@prisma/client', 'prisma'],
  outputFileTracingIncludes: {
    '/**': ['./prisma/**'],
  },
  images: {
    qualities: [75, 90],
    localPatterns: [
      {
        pathname: "/images/**",
      },
      { pathname: "/uploads/**" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
};

export default nextConfig;
