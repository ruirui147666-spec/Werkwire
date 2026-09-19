/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@werkwire/shared", "@werkwire/matching-engine"],
};

export default nextConfig;
