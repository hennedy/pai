/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Necessario para deploy em servidores Node.js (Hostinger, VPS)
  output: 'standalone',
}

module.exports = nextConfig
