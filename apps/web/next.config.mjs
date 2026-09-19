/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@werkwire/shared", "@werkwire/matching-engine"],
  webpack: (config) => {
    // @werkwire/shared and @werkwire/matching-engine use NodeNext-style
    // relative imports ("./foo.js" pointing at foo.ts) — webpack needs to
    // be told to resolve .js specifiers against .ts/.tsx sources too.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
