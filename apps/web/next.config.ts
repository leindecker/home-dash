import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@home-dash/types'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
