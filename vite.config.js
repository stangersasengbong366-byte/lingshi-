import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
