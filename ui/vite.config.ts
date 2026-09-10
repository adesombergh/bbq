import { devtools } from "@tanstack/devtools-vite"

import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const hub = process.env.VITE_HUB

export default defineConfig({
  build: {
    // One local page, served from disk by the hub: a single chunk is fine.
    chunkSizeWarningLimit: 800,
    emptyOutDir: true,
    outDir: "dist",
    sourcemap: false,
  },
  plugins: [
    devtools(),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: { tsconfigPaths: true },
  server: {
    fs: { allow: [".."] },
    // Dev only: proxy to a running hub. Set VITE_HUB=http://127.0.0.1:<port>
    proxy:
      hub === undefined
        ? undefined
        : {
            "/api": { target: hub },
            "/ws": { target: hub, ws: true },
          },
  },
})
