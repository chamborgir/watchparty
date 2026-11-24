import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /api requests are forwarded to the local API server (dev-api.js, port 3001).
// On Vercel, /api is served by the functions in the api/ folder instead.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
