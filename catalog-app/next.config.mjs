/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  devIndicators: false,
  async redirects() {
    return [
      { source: "/filter", destination: "/finder", permanent: true },
      { source: "/filter/", destination: "/finder", permanent: true },
    ];
  },
};

export default nextConfig;
