import bundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-plotly.js'],
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
