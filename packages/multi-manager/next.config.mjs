import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const API_ORIGIN = process.env.MANAGER_API_ORIGIN || 'http://127.0.0.1:17329';
const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(configDir, '../..'),
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
