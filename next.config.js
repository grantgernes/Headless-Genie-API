/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // Let Salesforce Lightning / classic / Visualforce iframe the app.
            // CSP frame-ancestors is the modern replacement for X-Frame-Options
            // and supports multiple allowed origins.
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://*.lightning.force.com https://*.salesforce.com https://*.force.com https://*.visualforce.com",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
