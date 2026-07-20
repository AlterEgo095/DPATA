import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  
  // TypeScript settings
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // React strict mode for development
  reactStrictMode: true,
  
  // Allowed origins
  allowedDevOrigins: ["21.0.22.52", "localhost", "127.0.0.1"],
  
  // No external packages needed at server level
  serverExternalPackages: [],
  
  // Image optimization - Enhanced for CDN/Performance
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // Enable remote images for potential CDN use
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cdn.com',
      },
    ],
    // Minimum cache duration (TTL) in seconds
    minimumCacheTTL: 60,
  },
  
  // Headers for security and caching - Enhanced
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          // Security headers for API
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          // Long-term caching for static assets (CDN-friendly)
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          // Security headers
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Additional security & performance headers
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Remove X-Powered-By header (security)
          { key: 'X-Powered-By', value: '' },
        ],
      },
      // Font optimization headers
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, immutable' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
  
  // Webpack optimizations for bundle size (fallback for webpack mode)
  webpack: (config, { isServer }) => {
    // Optimize bundle size
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@': require('path').resolve(__dirname, 'src'),
      };
      
      // Split vendor chunks for better caching
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'initial',
              priority: -10,
            },
          },
        },
      };
    }
    
    return config;
  },
  
  // Turbopack configuration (Next.js 16 default)
  turbopack: {},
  
  // Experimental features - Only valid keys for Next.js 16
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  
  // Power-by header removal
  poweredByHeader: false,
};

export default nextConfig;
