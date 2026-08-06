import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const buildVersion = Date.now().toString(36);

export default defineConfig({
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    react(),
    {
      name: "benefits-version-manifest",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ version: buildVersion }),
        });
      },
    },
  ],
  base: process.env.GITHUB_ACTIONS ? "/lingshi-/" : "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/html2canvas/")) return "html2canvas";
          return undefined;
        },
        chunkFileNames(chunkInfo) {
          return chunkInfo.name === "html2canvas"
            ? "assets/html2canvas.esm.js"
            : "assets/[name]-[hash].js";
        },
      },
    },
  },
});
