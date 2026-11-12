/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/**": ["./content/**/*"],
  },
  // Fold for Covid's cover is an SVG. The optimizer refuses those unless
  // this is set; the file is authored here and carries no script.
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // AgentReady became Stage 2 of DevRadar on 2026-10-20.
  async redirects() {
    return [
      {
        source: "/projects/agentready",
        destination: "/projects/devradar",
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
