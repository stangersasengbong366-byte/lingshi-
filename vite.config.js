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
          // 课程底表体积较大，拆离首屏应用代码，便于浏览器并行下载和长期缓存。
          if (id.includes("/src/data/annualCourseLibrary.js")) return "annual-course-library";
          if (id.includes("/src/data/courseCatalog.js")) return "course-catalog";
          if (id.includes("/src/data/g1AutumnCourseData.js")) return "g1-autumn-course-data";
          if (id.includes("/src/data/g1AutumnGiftData.js")) return "g1-autumn-gift-data";
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
