import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function resolvePlotlyBundle() {
  try {
    return require.resolve('plotly.js-dist-min');
  } catch {
    return require.resolve('plotly.js');
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-plotly.js'],
  },
  async rewrites() {
    // Proxy /api/* to a server-reachable backend. Browser code should keep
    // using NEXT_PUBLIC_API_URL=/api when the backend is not public.
    const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
    const backendUrl = process.env.BACKEND_URL || (publicApiUrl && !publicApiUrl.startsWith('/') ? publicApiUrl : 'http://localhost:8000');
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
  webpack: (config) => {
    // Use the smaller pre-built Plotly bundle instead of the full package.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'plotly.js$': resolvePlotlyBundle(),
      'plotly.js/dist/plotly$': resolvePlotlyBundle(),
    };
    return config;
  },
};

export default nextConfig;
