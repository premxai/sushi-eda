import bundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import webpack from 'webpack';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

function resolvePlotlyBundle() {
  try {
    return require.resolve('plotly.js-dist-min');
  } catch {
    return require.resolve('plotly.js');
  }
}

function resolveOptional(specifier) {
  try {
    return require.resolve(specifier);
  } catch {
    return false;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-plotly.js'],
  },
  async rewrites() {
    // Proxy /api/* to the backend in local development
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
  webpack: (config, { isServer }) => {
    const bufferPolyfill = resolveOptional('buffer/');
    const resolvedBufferShim = bufferPolyfill || require.resolve('./src/shims/buffer.ts');

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'plotly.js$': resolvePlotlyBundle(),
      'plotly.js/dist/plotly$': resolvePlotlyBundle(),
      buffer: resolvedBufferShim,
      'buffer/': resolvedBufferShim,
    };
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      buffer: resolvedBufferShim,
    };
    if (!isServer && bufferPolyfill) {
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        })
      );
    }
    return config;
  },
};

const sentryConfig = {
  // Source maps are uploaded only when SENTRY_AUTH_TOKEN is set
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Disable Sentry build-time features when DSN is not configured
  disableServerWebpackPlugin: !process.env.SENTRY_DSN,
  disableClientWebpackPlugin: !process.env.SENTRY_DSN,

  // Automatically tree-shake Sentry debug code in production
  hideSourceMaps: true,
  widenClientFileUpload: true,
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), sentryConfig);
