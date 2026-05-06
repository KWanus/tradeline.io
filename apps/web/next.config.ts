import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // typedRoutes off — we use dynamic search-param URLs and a config-driven
  // sidebar; the type churn isn't worth it at this stage.
  typedRoutes: false,
};

export default config;
