import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  // Tauri expects a fixed port, fail if that port is not available
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: false,
  },
  // Env variables starting with VITE_ are exposed to the client
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    // Tauri uses Chromium on Windows (WebView2)
    target: "es2021",
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
