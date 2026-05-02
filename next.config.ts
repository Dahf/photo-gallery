import type { NextConfig } from 'next';

const photosBase = process.env.PHOTOS_PUBLIC_BASE_URL ?? 'http://localhost:9000/photos';
const photosUrl = (() => {
  try {
    return new URL(photosBase);
  } catch {
    return new URL('http://localhost:9000/photos');
  }
})();

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: { root: __dirname },
  serverExternalPackages: ['sharp'],
  images: {
    remotePatterns: [
      {
        protocol: photosUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: photosUrl.hostname,
        port: photosUrl.port || undefined,
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
