import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

if (process.env.GITHUB_ACTIONS) {
  const sourcePath = "src/main.jsx";
  let source = fs.readFileSync(sourcePath, "utf8");
  source = source.replace(
    'const activeProducts = useMemo(() => products.filter((item) => item.status === "在售"), [products]);',
    'const activeProducts = useMemo(() => { const live = products.filter((item) => item.status === "在售"); return live.length ? live : (salesOnly ? initialProducts.map(migrateStoredProduct).filter((item) => item.status === "在售") : live); }, [products, salesOnly]);',
  );
  source = source.replace(
    'function getSupabaseHeaders() {\n  return {\n    apikey: SUPABASE_ANON_KEY,\n    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,\n  };\n}',
    'function getSupabaseHeaders() {\n  return {\n    apikey: SUPABASE_ANON_KEY,\n  };\n}',
  );
  fs.writeFileSync(sourcePath, source);
}

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
