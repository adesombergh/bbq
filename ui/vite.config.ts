import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  server: {
    // Dev only: proxy to a running hub. Set VITE_HUB=http://127.0.0.1:<port>
    proxy: process.env.VITE_HUB
      ? {
          "/ws": { target: process.env.VITE_HUB, ws: true },
          "/api": { target: process.env.VITE_HUB },
        }
      : undefined,
    fs: { allow: [".."] },
  },
});
