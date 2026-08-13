import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

if (process.env.GITHUB_ACTIONS) {
  const sourcePath = "src/main.jsx";
  let source = fs.readFileSync(sourcePath, "utf8");

  const replaceOrThrow = (from, to, label) => {
    if (!source.includes(from)) throw new Error(`Cloud authority patch target missing: ${label}`);
    source = source.replace(from, to);
  };

  // Supabase publishable key is an API key, not a JWT bearer token.
  replaceOrThrow(
    'function getSupabaseHeaders() {\n  return {\n    apikey: SUPABASE_ANON_KEY,\n    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,\n  };\n}',
    'function getSupabaseHeaders() {\n  return {\n    apikey: SUPABASE_ANON_KEY,\n  };\n}',
    "supabase headers",
  );

  // Cloud records are authoritative. Do not run hard-coded product migrations or bundled
  // annual-course hydration over values that came from Supabase.
  replaceOrThrow(
`async function loadCloudProducts(configId, fallbackId = CLOUD_PRODUCTS_LEGACY_ID) {
  if (!cloudConfigEnabled) return null;
  const response = await fetch(\`${'${SUPABASE_URL}'}/rest/v1/${'${CLOUD_CONFIG_TABLE}'}?id=in.(${'${configId}'},${'${fallbackId}'})&select=id,payload,updated_at\`, {
    headers: getSupabaseHeaders(),
  });
  if (!response.ok) throw await createCloudError(response, "云端配置读取失败");
  const records = await response.json();
  const record = records.find((item) => item.id === configId) ?? records.find((item) => item.id === fallbackId);
  const products = Array.isArray(record?.payload?.products) ? record.payload.products : record?.payload;
  const gradeCourseLibraries = record?.payload?.gradeCourseLibraries ?? {};
  return Array.isArray(products) ? products.map((product) => {
    const shared = gradeCourseLibraries[product.grade];
    if (!shared) return migrateStoredProduct(product);
    const courseSourceMode = product.courseSourceMode ?? "grade";
    return migrateStoredProduct({
      ...product,
      annualCourseData: shared.data,
      annualCourseUploadNames: shared.uploadNames,
      courseUploadNames: courseSourceMode === "custom" ? product.customCourseUploadNames : shared.uploadNames,
      parsedCourseData: courseSourceMode === "custom" ? product.customCourseData : shared.data,
    });
  }) : null;
}`,
`async function loadCloudProducts(configId) {
  if (!cloudConfigEnabled) return null;
  const response = await fetch(\`${'${SUPABASE_URL}'}/rest/v1/${'${CLOUD_CONFIG_TABLE}'}?id=eq.${'${encodeURIComponent(configId)}'}&select=id,payload,updated_at&limit=1\`, {
    headers: getSupabaseHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw await createCloudError(response, "Supabase云端配置读取失败");
  const records = await response.json();
  const record = records[0];
  const products = Array.isArray(record?.payload?.products) ? record.payload.products : record?.payload;
  const gradeCourseLibraries = record?.payload?.gradeCourseLibraries ?? {};
  if (!Array.isArray(products)) return null;
  return products.map((product) => {
    const courseSourceMode = product.courseSourceMode ?? "grade";
    const shared = gradeCourseLibraries[product.grade];
    if (courseSourceMode === "custom") {
      return {
        ...product,
        annualCourseData: shared?.data,
        annualCourseUploadNames: shared?.uploadNames,
        courseUploadNames: product.customCourseUploadNames ?? {},
        parsedCourseData: product.customCourseData ?? { live: {}, video: {} },
      };
    }
    if (!shared) return product;
    return {
      ...product,
      annualCourseData: shared.data,
      annualCourseUploadNames: shared.uploadNames,
      courseUploadNames: shared.uploadNames,
      parsedCourseData: shared.data,
    };
  });
}`,
    "cloud product loader",
  );

  // While Supabase is loading, never render localStorage/default products as if they were current.
  replaceOrThrow(
    '  const [salesFeedback, setSalesFeedback] = useState([]);\n  const activeProducts = useMemo(() => products.filter((item) => item.status === "在售"), [products]);',
    '  const [salesFeedback, setSalesFeedback] = useState([]);\n  const [cloudLoadState, setCloudLoadState] = useState(cloudConfigEnabled ? "loading" : "ready");\n  const activeProducts = useMemo(() => products.filter((item) => item.status === "在售"), [products]);',
    "cloud load state",
  );

  replaceOrThrow(
`        if (cancelled || !cloudProducts?.length) {
          if (!cancelled) setSyncStatus("云端暂无配置");
          return;
        }`,
`        if (cancelled) return;
        if (!cloudProducts?.length) {
          setProducts([]);
          setSelectedProductId(undefined);
          setSyncStatus("Supabase云端暂无产品配置");
          setCloudLoadState("ready");
          return;
        }`,
    "empty cloud result",
  );

  replaceOrThrow(
    '        setSyncStatus(publicView ? "已同步最新发布版本" : "云端草稿已同步");',
    '        setSyncStatus(publicView ? "Supabase正式版已同步" : "Supabase草稿已同步");\n        setCloudLoadState("ready");',
    "cloud success state",
  );

  replaceOrThrow(
    '      .catch((error) => setSyncStatus(error?.isMissingTable ? "云端数据表未创建，当前使用本地配置" : "云端连接失败，已使用本地配置"));',
    '      .catch((error) => {\n        console.error("Supabase产品读取失败", error);\n        setProducts([]);\n        setSelectedProductId(undefined);\n        setSyncStatus(error?.isMissingTable ? "Supabase数据表未创建" : `Supabase连接失败：${error?.message || "请检查网络或密钥"}`);\n        setCloudLoadState("error");\n      });',
    "cloud error state",
  );

  replaceOrThrow(
`  if (shortLinkStatus === "loading") {
    return <main className="public-empty-state"><strong>正在打开短链</strong><span>正在读取云端权益配置，请稍候。</span></main>;
  }`,
`  if (cloudConfigEnabled && cloudLoadState === "loading" && !shortCode) {
    return <main className="public-empty-state"><strong>正在同步 Supabase</strong><span>正在读取最新产品、价格、课时与课程大纲，请稍候。</span></main>;
  }

  if (cloudConfigEnabled && cloudLoadState === "error" && !shortCode) {
    return <main className="public-empty-state"><strong>Supabase 云端连接失败</strong><span>为避免展示旧数据，当前已停止使用本地缓存，请刷新后重试。</span></main>;
  }

  if (shortLinkStatus === "loading") {
    return <main className="public-empty-state"><strong>正在打开短链</strong><span>正在读取云端权益配置，请稍候。</span></main>;
  }`,
    "cloud render gate",
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
