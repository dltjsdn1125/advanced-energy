/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "true";

const nextConfig = {
  // Electron builds: NEXT_STATIC_EXPORT=true → static file output (no API routes)
  // Web/Railway: default → full server with API routes enabled
  ...(isStaticExport
    ? { output: "export", trailingSlash: true, assetPrefix: "./" }
    : {}),
  images: { unoptimized: true },
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer"],
  async redirects() {
    if (isStaticExport) return [];
    return [
      { source: "/filter", destination: "/finder", permanent: true },
      { source: "/filter/", destination: "/finder", permanent: true },
    ];
  },
};

export default nextConfig;
