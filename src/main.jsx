import React, { Fragment, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import {
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Download,
  Database,
  Eye,
  FileText,
  Gift,
  GraduationCap,
  ImagePlus,
  Layers,
  ListChecks,
  PackageCheck,
  Pencil,
  PlayCircle,
  Plus,
  Save,
  Settings,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { initialProducts, moduleLibrary } from "./data/products";
import { courseCatalog, courseSubjects } from "./data/courseCatalog";
import { giftCatalog } from "./data/giftCatalog";
import { getTeachingAidItems, getTeachingAidRule } from "./data/teachingAidCatalog";
import { annualCourseLibrary, annualCourseLibraryVersion } from "./data/annualCourseLibrary";
import { parseCourseWorkbookSheets } from "./lib/courseWorkbookParser";
import supabaseSchemaSql from "../supabase/schema.sql?raw";
import "./styles.css";

const gradeLabels = ["高一", "高二", "高三"];
const stageLabels = ["夏研卡", "秋实卡", "决胜卡", "直通卡", "一轮卡", "二轮卡"];
const humanitiesSubjects = ["生物", "历史", "地理", "政治"];
const courseGiftRuleOptions = [
  "买满1科赠对应学科",
  "买满2科赠对应学科",
  "买满3科赠对应学科",
];
const physicalGiftRuleOptions = ["买满1科赠", "买满2科赠", "买满3科赠"];
const giftCategoryOptions = ["学科类赠课", "升学赋能包"];
const videoTrackOptions = ["目标班", "菁英班"];
const giftCategoryMeta = {
  "学科类赠课": { index: "01", note: "随所购学科匹配，买哪科赠哪科" },
  "升学赋能包": { index: "02", note: "选科、成长与升学规划通用权益" },
  "实物赠送": { index: "03", note: "教辅资料、文创与达标实物礼" },
};
const giftImageLibrary = [
  { names: ["暑期学法知识视频包", "高一暑期重难点精华课"], category: "学科类赠课", image: "/assets/gifts/summer-review.png" },
  { names: ["新高一入门知识精讲"], category: "学科类赠课", image: "/assets/gifts/freshman-foundation.jpg" },
  { names: ["高一选科宝典"], category: "升学赋能包", image: "/assets/gifts/subject-selection-guide.png" },
  { names: ["高一家长成长计划"], category: "升学赋能包", image: "/assets/gifts/parent-growth-plan.png" },
  { names: ["高中升学路径全解"], category: "升学赋能包", image: "/assets/gifts/pathway-guide.png" },
  { names: ["极境拾音坞", "实物单品"], category: "实物赠送", image: "/assets/gifts/sound-dock.jpg" },
  { names: ["午福临门", "升学礼包"], category: "实物赠送", image: "/assets/gifts/fortune-gift-box.png" },
  { names: ["草稿本"], category: "实物赠送", image: "/assets/gifts/draft-notebooks.png" },
];
const PRODUCTS_STORAGE_KEY = "youdao-benefits-products-v5-g1-autumn-course-refresh";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || "https://stangersasengbong366-byte.github.io/lingshi-/";
const CLOUD_CONFIG_TABLE = "benefit_configs";
const CLOUD_PRODUCTS_LEGACY_ID = "products";
const CLOUD_PRODUCTS_DRAFT_ID = "products_draft";
const CLOUD_PRODUCTS_PUBLISHED_ID = "products_published";
const cloudConfigEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function assetUrl(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

function loadStoredProducts() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PRODUCTS_STORAGE_KEY) || "[]");
    if (!Array.isArray(stored) || !stored.length) return initialProducts.map(migrateStoredProduct);
    return stored.map(migrateStoredProduct);
  } catch {
    return initialProducts.map(migrateStoredProduct);
  }
}

function migrateStoredProduct(product) {
  const isG1Autumn = String(product.grade).includes("高一") && `${product.stage}${product.name}`.includes("秋实");
  const migrated = isG1Autumn && product.productProfileVersion !== "2026-07-17-authoritative-v1" ? {
    ...product,
    name: "新高一秋实卡",
    term: "26H2 秋季",
    subtitle: "新高一秋季系统学习，学法直播讲透方法，知识视频分层补足基础。",
    videoSubjects: ["语文", "数学", "英语", "物理", "化学"],
    unlayeredVideoSubjects: ["语文"],
    layeredVideoSubjects: ["数学", "英语", "物理", "化学"],
    core: {
      ...product.core,
      liveLessons: 16,
      liveDuration: "2h",
      knowledgeVideos: 40,
      videoDuration: "30min",
      servicePeriod: "4个月",
    },
    serviceDateRange: "2026.09.01-2026.12.31",
    courseValidity: "即日起至2029.08.31",
    salePeriod: "2026.07.26起",
    pricing: {
      originalPerSubject: 3600,
      singlePerSubject: 2780,
      twoPerSubject: 2680,
      threePlusPerSubject: 2580,
    },
    humanitiesPricing: {
      originalPerSubject: 2200,
      fixedPerSubject: 900,
    },
    giftSelections: null,
    physicalGiftSelections: null,
    giftOverrides: {},
    productProfileVersion: "2026-07-17-authoritative-v1",
    videoReleasePlan: "购买后立即开放3节试听，其余视频自8月起分批释放",
  } : product;
  return hydrateAnnualCourseProduct(migrated);
}

function hydrateAnnualCourseProduct(product) {
  const annualData = annualCourseLibrary[product.grade];
  const uploadNames = product.annualCourseUploadNames ?? product.courseUploadNames ?? {};
  const isLegacyProductUpload = Object.values(uploadNames).some((name) => /秋实|夏研|决胜|直通|一轮卡/.test(String(name ?? "")));
  const currentManualVersion = `uploaded-${annualCourseLibraryVersion}`;
  const hasCurrentAnnualUpload = product.annualCourseOrigin === "uploaded"
    && product.annualCourseVersion === currentManualVersion
    && !isLegacyProductUpload;
  if (!annualData) return product;
  if (hasCurrentAnnualUpload) return product;
  const hasLoadedAnnualCourse = courseSubjects.some((subject) => (
    product.parsedCourseData?.live?.[subject]?.length
    || product.parsedCourseData?.video?.[subject]?.length
  ));
  if (product.annualCourseVersion === annualCourseLibraryVersion && !isLegacyProductUpload && hasLoadedAnnualCourse) return product;
  const annualNames = {
    live: "学法直播.xlsx",
    video: "知识视频.xlsx",
  };
  const next = {
    ...product,
    annualCourseData: annualData,
    annualCourseUploadNames: annualNames,
    annualCourseOrigin: "bundled",
    annualCourseVersion: annualCourseLibraryVersion,
  };
  if ((product.courseSourceMode ?? "grade") === "custom" && !isLegacyProductUpload) return next;
  return {
    ...next,
    courseSourceMode: "grade",
    courseUploadNames: annualNames,
    parsedCourseData: annualData,
  };
}

function saveStoredProducts(products) {
  window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
}

async function loadCloudProducts(configId, fallbackId = CLOUD_PRODUCTS_LEGACY_ID) {
  if (!cloudConfigEnabled) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${CLOUD_CONFIG_TABLE}?id=in.(${configId},${fallbackId})&select=id,payload,updated_at`, {
    headers: getSupabaseHeaders(),
  });
  if (!response.ok) throw await createCloudError(response, "云端配置读取失败");
  const records = await response.json();
  const record = records.find((item) => item.id === configId) ?? records.find((item) => item.id === fallbackId);
  const products = Array.isArray(record?.payload?.products) ? record.payload.products : record?.payload;
  return Array.isArray(products) ? products.map(migrateStoredProduct) : null;
}

async function saveCloudProducts(products, configId = CLOUD_PRODUCTS_DRAFT_ID) {
  if (!cloudConfigEnabled) throw new Error("云端配置未连接");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${CLOUD_CONFIG_TABLE}?on_conflict=id`, {
    method: "POST",
    headers: {
      ...getSupabaseHeaders(),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: configId,
      payload: { products, version: Date.now() },
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw await createCloudError(response, "云端配置保存失败");
}

async function createCloudError(response, fallbackMessage) {
  const responseText = await response.text();
  let detail = responseText;
  try {
    const parsed = JSON.parse(responseText);
    detail = [parsed.code, parsed.message, parsed.hint].filter(Boolean).join(" · ");
  } catch {
    // Keep the original response text when the service does not return JSON.
  }
  const error = new Error(detail || fallbackMessage);
  error.status = response.status;
  error.isMissingTable = /PGRST205|benefit_configs.*schema cache|Could not find the table/i.test(detail);
  return error;
}

function getSupabaseHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

function App() {
  const shareParams = getShareParams();
  const salesOnly = getSalesOnlyMode();
  const publicView = Boolean(shareParams || salesOnly);
  const [activePage, setActivePage] = useState("sales");
  const [products, setProducts] = useState(loadStoredProducts);
  const [syncStatus, setSyncStatus] = useState(cloudConfigEnabled ? "正在同步云端配置" : "本地配置");
  const [selectedProductId, setSelectedProductId] = useState(() => shareParams?.productId ?? loadStoredProducts()[0]?.id ?? initialProducts[0].id);
  const [selectedSubjects, setSelectedSubjects] = useState(() => shareParams?.subjects ?? [shareParams?.subject ?? "数学"]);
  const [selectedVideoTracks, setSelectedVideoTracks] = useState(() => shareParams?.videoTracks ?? {});
  const selectedProduct = products.find((item) => item.id === selectedProductId) ?? products[0];
  const selectedCoursePlans = selectedSubjects.map((subject) => resolveCoursePlan(
    selectedProduct,
    subject,
    undefined,
    selectedVideoTracks[subject] ?? "目标班",
  ));
  const selectedCoursePlan = selectedCoursePlans[0];

  React.useEffect(() => {
    if (!cloudConfigEnabled) return undefined;
    let cancelled = false;
    const configId = publicView ? CLOUD_PRODUCTS_PUBLISHED_ID : CLOUD_PRODUCTS_DRAFT_ID;
    loadCloudProducts(configId)
      .then((cloudProducts) => {
        if (cancelled || !cloudProducts?.length) {
          if (!cancelled) setSyncStatus("云端暂无配置");
          return;
        }
        const nextProducts = cloudProducts;
        setProducts(nextProducts);
        saveStoredProducts(nextProducts);
        setSelectedProductId((current) => nextProducts.some((product) => product.id === current) ? current : nextProducts[0]?.id);
        setSyncStatus(publicView ? "已同步最新发布版本" : "云端草稿已同步");
      })
      .catch((error) => setSyncStatus(error?.isMissingTable ? "云端数据表未创建，当前使用本地配置" : "云端连接失败，已使用本地配置"));
    return () => {
      cancelled = true;
    };
  }, [publicView]);

  const updateProduct = async (nextProduct) => {
    const nextProducts = products.map((item) => {
      if (item.id === nextProduct.id) return nextProduct;
      if (item.grade !== nextProduct.grade) return item;
      const sharedCourseLibrary = {
        ...item,
        annualCourseUploadNames: nextProduct.annualCourseUploadNames,
        annualCourseData: nextProduct.annualCourseData,
        annualCourseOrigin: nextProduct.annualCourseOrigin,
        annualCourseVersion: nextProduct.annualCourseVersion,
      };
      if ((item.courseSourceMode ?? "grade") === "custom") return sharedCourseLibrary;
      return {
        ...sharedCourseLibrary,
        courseUploadNames: nextProduct.annualCourseUploadNames,
        parsedCourseData: nextProduct.annualCourseData,
      };
    });
    setProducts(nextProducts);
    saveStoredProducts(nextProducts);
    setSelectedProductId(nextProduct.id);
    setSyncStatus("正在保存并同步销售端");
    try {
      await Promise.all([
        saveCloudProducts(nextProducts, CLOUD_PRODUCTS_DRAFT_ID),
        saveCloudProducts(nextProducts, CLOUD_PRODUCTS_PUBLISHED_ID),
      ]);
      setSyncStatus("已保存到云端，销售端同步完成");
      return { cloudSaved: true };
    } catch (error) {
      setSyncStatus(error?.isMissingTable ? "云端数据表未创建，仅保存在本机" : "云端保存失败，仅保存在本机");
      return { cloudSaved: false, error };
    }
  };

  const publishProducts = async (nextProduct) => {
    const nextProducts = nextProduct
      ? products.map((item) => (item.id === nextProduct.id ? nextProduct : item))
      : products;
    await saveCloudProducts(nextProducts, CLOUD_PRODUCTS_PUBLISHED_ID);
    setSyncStatus("已发布，销售端将读取最新版本");
  };

  const addProduct = async () => {
    const nextProduct = createNewProduct(selectedProduct);
    const nextProducts = [...products, nextProduct];
    setProducts(nextProducts);
    saveStoredProducts(nextProducts);
    setSelectedProductId(nextProduct.id);
    setSyncStatus("正在保存新产品并同步销售端");
    try {
      await Promise.all([
        saveCloudProducts(nextProducts, CLOUD_PRODUCTS_DRAFT_ID),
        saveCloudProducts(nextProducts, CLOUD_PRODUCTS_PUBLISHED_ID),
      ]);
      setSyncStatus("新产品已同步到云端销售端");
    } catch (error) {
      setSyncStatus(error?.isMissingTable ? "云端数据表未创建，新产品仅保存在本机" : "云端保存失败，新产品仅保存在本机");
    }
    return nextProduct;
  };

  if (shareParams) {
    return (
      <CustomerSharePage
        products={products}
        product={selectedProduct}
        selectedSubjects={selectedSubjects}
        selectedVideoTracks={selectedVideoTracks}
        coursePlans={selectedCoursePlans}
        viewMode={shareParams.viewMode}
      />
    );
  }

  return (
    <main className="app-shell">
      <AppHeader activePage={activePage} onPageChange={setActivePage} syncStatus={syncStatus} salesOnly={salesOnly} />
      {activePage === "sales" && (
        <SalesPage
          products={products}
          selectedProduct={selectedProduct}
          selectedSubjects={selectedSubjects}
          selectedVideoTracks={selectedVideoTracks}
          coursePlans={selectedCoursePlans}
          onSelect={setSelectedProductId}
          onSubjectsChange={setSelectedSubjects}
          onVideoTrackChange={(subject, track) => setSelectedVideoTracks((current) => ({ ...current, [subject]: track }))}
        />
      )}
      {activePage === "admin" && (
        <AdminPage
          products={products}
          selectedProduct={selectedProduct}
          onSelect={setSelectedProductId}
          onAdd={addProduct}
          onUpdate={updateProduct}
          onPublish={publishProducts}
          syncStatus={syncStatus}
        />
      )}
    </main>
  );
}

function createNewProduct(template) {
  const grade = template?.grade ?? "高一";
  const stage = grade === "高三" ? "一轮卡" : "秋实卡";
  const coveragePhases = grade === "高三" ? ["一轮"] : ["秋季"];
  const annualData = annualCourseLibrary[grade] ?? { live: {}, video: {} };
  const stageCounts = getCourseStageCounts(annualData, coveragePhases);
  return {
    ...(template ?? initialProducts[0]),
    id: `product-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: `${grade}新产品`,
    grade,
    stage,
    courseKey: stage,
    term: "",
    status: "待上线",
    coveragePhases,
    videoPhases: coveragePhases,
    subtitle: "",
    salesNote: "",
    core: {
      ...(template?.core ?? {}),
      liveLessons: stageCounts.live,
      knowledgeVideos: stageCounts.video,
      servicePeriod: "",
    },
    pricing: {
      originalPerSubject: 0,
      singlePerSubject: 0,
      twoPerSubject: 0,
      threePlusPerSubject: 0,
    },
    courseSourceMode: "grade",
    annualCourseData: annualData,
    parsedCourseData: annualData,
    annualCourseOrigin: "bundled",
    annualCourseVersion: annualCourseLibraryVersion,
    customCourseData: { live: {}, video: {} },
    customCourseUploadNames: {},
    giftSelections: [],
    physicalGiftSelections: [],
    customGiftItems: [],
    customPhysicalGiftItems: [],
    giftOverrides: {},
  };
}

function getSalesOnlyMode() {
  return new URLSearchParams(window.location.search).get("sales") === "1";
}

function getShareParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("share") !== "1") return null;
  const subjects = (params.get("subjects") || params.get("subject") || "数学").split(",").map((item) => item.trim()).filter(Boolean);
  const legacyTrack = /菁英|精英/.test(params.get("track") || "") ? "菁英班" : "目标班";
  const videoTracks = Object.fromEntries(subjects.map((subject) => [subject, legacyTrack]));
  (params.get("tracks") || "").split(",").forEach((entry) => {
    const [subject, track] = entry.split(":");
    if (subject && track) videoTracks[subject] = /菁英|精英/.test(track) ? "菁英班" : "目标班";
  });
  return {
    productId: params.get("product") || initialProducts[0].id,
    subject: params.get("subject") || "数学",
    subjects,
    videoTracks,
    viewMode: params.get("view") === "detail" ? "detail" : "summary",
  };
}

function formatSubjectTracks(subjects, tracks) {
  return subjects.map((subject) => `${subject}·${tracks?.[subject] ?? "目标班"}`).join(" / ");
}

function AppHeader({ activePage, onPageChange, syncStatus, salesOnly }) {
  const pages = [
    { id: "sales", label: "生成清单", icon: Eye },
    { id: "admin", label: "后台配置", icon: Settings },
  ];

  return (
    <header className="topbar">
      <div className="brand-lockup">
        <img src={assetUrl("/assets/youdao-logo.png")} alt="网易有道领世" />
        <div className="brand-title">
          <strong>产品权益清单生成工具</strong>
          <span>销售选择产品后，自动生成用户可读清单</span>
        </div>
      </div>
      <div className={cloudConfigEnabled ? "cloud-status enabled" : "cloud-status"}>
        {syncStatus}
      </div>
      {!salesOnly ? <nav className="page-tabs" aria-label="页面切换">
        {pages.map((page) => {
          const Icon = page.icon;
          return (
            <button
              key={page.id}
              className={activePage === page.id ? "tab-button active" : "tab-button"}
              onClick={() => onPageChange(page.id)}
              type="button"
              title={page.label}
            >
              <Icon size={17} />
              <span>{page.label}</span>
            </button>
          );
        })}
      </nav> : null}
    </header>
  );
}

function SalesPage({ products, selectedProduct, selectedSubjects, selectedVideoTracks, coursePlans, onSelect, onSubjectsChange, onVideoTrackChange }) {
  const previewRef = useRef(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState(() => (
    new URLSearchParams(window.location.search).get("view") === "detail" ? "detail" : "summary"
  ));

  const productOptions = useMemo(() => {
    return products.filter((item) => item.status === "在售");
  }, [products]);
  const gradeOptions = useMemo(() => [...new Set(productOptions.map((item) => item.grade))], [productOptions]);
  const stageOptions = useMemo(
    () => [...new Set(productOptions.filter((item) => item.grade === selectedProduct.grade).map((item) => item.stage))],
    [productOptions, selectedProduct.grade],
  );
  const selectedSubjectText = selectedSubjects.join("、");
  const liveTotal = coursePlans.reduce((sum, plan) => sum + (plan?.liveCount ?? 0), 0);
  const videoTotal = coursePlans.reduce((sum, plan) => sum + (plan?.videoEntitlement ?? 0), 0);

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(buildShareUrl(selectedProduct, selectedSubjects, viewMode, selectedVideoTracks));
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1600);
  };

  const exportImage = async () => {
    if (!previewRef.current || exporting) return;
    setExporting(true);
    try {
      const versionName = viewMode === "detail" ? "明细版" : "清单版";
      await exportElementAsPng(previewRef.current, `${selectedProduct.name}-${versionName}权益清单.png`);
    } catch (error) {
      console.error(error);
      window.alert("长图生成失败，请稍后重试。");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="workspace two-column">
      <aside className="selector-panel">
        <div className="panel-heading">
          <span className="eyebrow">销售操作</span>
          <h1>选择产品</h1>
        </div>
        <Field label="年级">
          <SegmentedSelect
            options={gradeOptions}
            value={selectedProduct.grade}
            onChange={(grade) => {
              const next = productOptions.find((item) => item.grade === grade) ?? selectedProduct;
              onSelect(next.id);
            }}
          />
        </Field>
        <Field label="阶段包装">
          <SegmentedSelect
            options={stageOptions}
            value={selectedProduct.stage}
            onChange={(stage) => {
              const next =
                productOptions.find((item) => item.grade === selectedProduct.grade && item.stage === stage) ??
                selectedProduct;
              onSelect(next.id);
            }}
          />
        </Field>
        <Field label="产品名称">
          <div className="select-wrap">
            <select value={selectedProduct.id} onChange={(event) => onSelect(event.target.value)}>
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </div>
        </Field>
        <Field label="科目">
          <div className="subject-grid">
            {courseSubjects.map((subject) => (
              <button
                key={subject}
                type="button"
                className={selectedSubjects.includes(subject) ? "subject-chip active" : "subject-chip"}
                onClick={() => {
                  const nextSubjects = selectedSubjects.includes(subject)
                    ? selectedSubjects.filter((item) => item !== subject)
                    : [...selectedSubjects, subject];
                  onSubjectsChange(nextSubjects.length ? nextSubjects : [subject]);
                }}
              >
                {subject}
              </button>
            ))}
          </div>
        </Field>
        <Field label="各科知识视频班型">
          <div className="subject-track-list">
            {selectedSubjects.map((subject) => {
              const hasVideo = selectedProduct.videoSubjects?.includes(subject);
              const isLayered = selectedProduct.layeredVideoSubjects?.includes(subject);
              return (
                <div className="subject-track-row" key={subject}>
                  <strong>{subject}</strong>
                  {isLayered ? (
                    <SegmentedSelect
                      options={videoTrackOptions}
                      value={selectedVideoTracks[subject] ?? "目标班"}
                      onChange={(track) => onVideoTrackChange(subject, track)}
                    />
                  ) : <span className="subject-track-status">{hasVideo ? "不分层" : "无知识视频"}</span>}
                </div>
              );
            })}
          </div>
          <p className="field-help">数英物化可独立选择“目标班”或“菁英班”；语文不分层，生政史地本产品无知识视频。</p>
        </Field>
        <Field label="页面类型">
          <div className="version-switch" role="group" aria-label="页面类型">
            <button
              className={viewMode === "summary" ? "active" : ""}
              type="button"
              onClick={() => setViewMode("summary")}
            >
              <span>一</span>
              <div><strong>清单预览</strong><small>一页看完核心权益</small></div>
            </button>
            <button
              className={viewMode === "detail" ? "active" : ""}
              type="button"
              onClick={() => setViewMode("detail")}
            >
              <span>二</span>
              <div><strong>详细页面</strong><small>直接展示完整大纲</small></div>
            </button>
          </div>
        </Field>
        <div className="quick-facts">
          <Metric icon={BookOpen} label={`${selectedSubjects.length}科 学法直播`} value={`${liveTotal || selectedProduct.core.liveLessons}节`} />
          <Metric icon={Layers} label={`${selectedSubjectText} 知识视频`} value={`${videoTotal}节`} />
          <Metric icon={GraduationCap} label="服务周期" value={selectedProduct.core.servicePeriod} />
        </div>
        <div className="action-stack">
          <button className="primary-action" type="button" onClick={copyShareLink}>
            <Share2 size={18} />
            <span>{linkCopied ? "链接已复制" : "复制分享链接"}</span>
          </button>
          <button className="secondary-action" type="button" onClick={exportImage} disabled={exporting}>
            <Download size={18} />
            <span>{exporting ? "生成中..." : "导出图片"}</span>
          </button>
        </div>
      </aside>
      <section className="preview-panel">
        <div className="preview-toolbar">
          <div>
            <span className="eyebrow">实时预览</span>
            <h2>销售展示清单</h2>
          </div>
          <span className="status-pill">适合微信发送</span>
        </div>
        <BenefitSheet
          products={products}
          product={selectedProduct}
          coursePlans={coursePlans}
          refNode={previewRef}
          mode="sales"
          viewMode={viewMode}
        />
      </section>
    </section>
  );
}

function CustomerSharePage({ products, product, selectedSubjects, selectedVideoTracks, coursePlans, viewMode }) {
  const [opened, setOpened] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  const openEnvelope = () => {
    if (isOpening) return;
    setIsOpening(true);
    window.setTimeout(() => {
      setOpened(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 850);
  };

  if (!opened) {
    return (
      <main className={isOpening ? "share-shell opening" : "share-shell"}>
        <section className="share-envelope-screen">
          <div className="share-logo-line">
            <img src={assetUrl("/assets/youdao-logo.png")} alt="网易有道领世" />
            <span>{product.term}</span>
          </div>
          <div className={isOpening ? "share-envelope opening" : "share-envelope"} onClick={openEnvelope}>
            <div className="share-envelope-back" />
            <div className="share-envelope-side left" />
            <div className="share-envelope-side right" />
            <div className="share-envelope-bottom" />
            <div className="share-envelope-flap" />
            <button
              className="share-wax"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openEnvelope();
              }}
              aria-label="开启权益清单"
            >
              <img src={assetUrl("/assets/wax-seal-cutout.png")} alt="" />
            </button>
          </div>
          <div className="share-opening-copy">
            <span>{product.name} · {formatSubjectTracks(selectedSubjects, selectedVideoTracks)}</span>
            <p>点击火漆章，开启你的专属权益清单。</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="share-shell opened">
      <section className="share-result">
        <div className="share-result-head">
          <img src={assetUrl("/assets/youdao-logo.png")} alt="网易有道领世" />
          <div>
            <span>权益清单已开启</span>
            <strong>{product.name} · {formatSubjectTracks(selectedSubjects, selectedVideoTracks)}</strong>
          </div>
        </div>
        <BenefitSheet products={products} product={product} coursePlans={coursePlans} mode="poster" viewMode={viewMode} />
      </section>
    </main>
  );
}

function AdminPage({ products, selectedProduct, onSelect, onAdd, onUpdate, onPublish, syncStatus }) {
  const [draft, setDraft] = useState(selectedProduct);
  const [activeAdminSection, setActiveAdminSection] = useState("basic");
  const [expandedGiftKey, setExpandedGiftKey] = useState("");
  const [uploadNames, setUploadNames] = useState({});
  const [courseSourceMode, setCourseSourceMode] = useState(selectedProduct.courseSourceMode ?? "grade");
  const [annualCourseData, setAnnualCourseData] = useState(selectedProduct.annualCourseData ?? selectedProduct.parsedCourseData ?? { live: {}, video: {} });
  const [customCourseData, setCustomCourseData] = useState(selectedProduct.customCourseData ?? { live: {}, video: {} });
  const [parsedSubject, setParsedSubject] = useState("语文");
  const [newGift, setNewGift] = useState({ name: "", detail: "", value: "", lessonCount: "", mainContent: "", category: "学科类赠课", rule: "买满1科赠对应学科", image: "" });
  const [newPhysicalGift, setNewPhysicalGift] = useState({ name: "", detail: "", value: "", rule: "买满1科赠" });
  const [lastGiftImport, setLastGiftImport] = useState(null);
  const [publishState, setPublishState] = useState("idle");
  const [saveState, setSaveState] = useState("idle");
  const [salesLinkCopied, setSalesLinkCopied] = useState(false);
  const [schemaCopied, setSchemaCopied] = useState(false);
  const courseGiftItems = getGradeGiftCandidates(products, draft).filter((item) => item.type === "赠课");
  const defaultSelectedGiftKeys = getAdminGiftCandidates(draft).filter((item) => item.type === "赠课").map(getGiftItemKey);
  const selectedGiftKeys = normalizeSelectedGiftKeys(draft.giftSelections ?? defaultSelectedGiftKeys, courseGiftItems);
  const physicalGiftItems = getGradePhysicalGiftCandidates(products, draft);
  const defaultPhysicalGiftKeys = physicalGiftItems.map(getGiftItemKey);
  const selectedPhysicalGiftKeys = normalizeSelectedGiftKeys(draft.physicalGiftSelections ?? defaultPhysicalGiftKeys, physicalGiftItems);
  const parsedCourseData = courseSourceMode === "custom" ? customCourseData : annualCourseData;
  const activeCourseUploadNames = courseSourceMode === "custom"
    ? { live: uploadNames.customLive ?? "", video: uploadNames.customVideo ?? "" }
    : { live: uploadNames.annualLive ?? "", video: uploadNames.annualVideo ?? "" };
  const parsedLiveCount = Object.values(parsedCourseData.live ?? {}).reduce((total, rows) => total + (rows?.length ?? 0), 0);
  const parsedVideoCount = Object.values(parsedCourseData.video ?? {}).reduce((total, rows) => total + (rows?.length ?? 0), 0);
  const publishChecks = [
    { label: "产品信息", ready: Boolean(draft.name?.trim() && draft.grade && draft.core?.servicePeriod) },
    { label: "价格", ready: Boolean(draft.pricing?.singlePerSubject && draft.pricing?.twoPerSubject && draft.pricing?.threePlusPerSubject) },
    { label: "学法直播", ready: Boolean(activeCourseUploadNames.live && parsedLiveCount) },
    { label: "知识视频", ready: !Number(draft.core?.knowledgeVideos) || Boolean(activeCourseUploadNames.video && parsedVideoCount) },
    { label: "赠送规则", ready: Boolean(selectedGiftKeys.length || selectedPhysicalGiftKeys.length) },
  ];
  const missingPublishItems = publishChecks.filter((item) => !item.ready);
  const canPublish = cloudConfigEnabled && missingPublishItems.length === 0;

  React.useEffect(() => {
    setDraft(selectedProduct);
    setExpandedGiftKey("");
    const legacyNames = selectedProduct.courseUploadNames ?? {};
    const annualNames = selectedProduct.annualCourseUploadNames ?? legacyNames;
    const customNames = selectedProduct.customCourseUploadNames ?? {};
    setUploadNames({
      annualLive: annualNames.live ?? "",
      annualVideo: annualNames.video ?? "",
      customLive: customNames.live ?? "",
      customVideo: customNames.video ?? "",
    });
    setCourseSourceMode(selectedProduct.courseSourceMode ?? "grade");
    setAnnualCourseData(selectedProduct.annualCourseData ?? selectedProduct.parsedCourseData ?? { live: {}, video: {} });
    setCustomCourseData(selectedProduct.customCourseData ?? { live: {}, video: {} });
    setParsedSubject("语文");
    setNewGift({ name: "", detail: "", value: "", lessonCount: "", mainContent: "", category: "学科类赠课", rule: "买满1科赠对应学科", image: "" });
    setNewPhysicalGift({ name: "", detail: "", value: "", rule: "买满1科赠" });
    setLastGiftImport(null);
  }, [selectedProduct]);

  const updateCore = (key, value) => {
    setDraft({ ...draft, core: { ...draft.core, [key]: value } });
  };

  const updatePricing = (key, value) => {
    setDraft({ ...draft, pricing: { ...draft.pricing, [key]: Number(value) || 0 } });
  };

  const changeProductGrade = (grade) => {
    if (grade === draft.grade) return;
    const nextAnnualData = annualCourseLibrary[grade] ?? { live: {}, video: {} };
    const nextGradeProduct = { ...draft, grade };
    const coveragePhases = getDefaultCoveragePhases(nextGradeProduct);
    const stageCounts = getCourseStageCounts(nextAnnualData, coveragePhases);
    if (courseSourceMode === "grade") setAnnualCourseData(nextAnnualData);
    setParsedSubject("语文");
    setDraft({
      ...draft,
      grade,
      coveragePhases,
      videoPhases: coveragePhases,
      ...(courseSourceMode === "grade" ? {
        annualCourseData: nextAnnualData,
        annualCourseOrigin: "bundled",
        annualCourseVersion: annualCourseLibraryVersion,
      } : {}),
      core: {
        ...draft.core,
        liveLessons: stageCounts.live,
        knowledgeVideos: stageCounts.video,
      },
    });
  };

  const changeCourseSourceMode = (mode) => {
    setCourseSourceMode(mode);
    const coveragePhases = draft.coveragePhases?.length ? draft.coveragePhases : getDefaultCoveragePhases(draft);
    if (mode === "custom") {
      const stageCounts = getCourseStageCounts(customCourseData, coveragePhases);
      setDraft({
        ...draft,
        courseSourceMode: "custom",
        core: {
          ...draft.core,
          liveLessons: stageCounts.live,
          knowledgeVideos: stageCounts.video,
        },
      });
      return;
    }
    const nextAnnualData = annualCourseLibrary[draft.grade] ?? annualCourseData;
    const stageCounts = getCourseStageCounts(nextAnnualData, coveragePhases);
    setAnnualCourseData(nextAnnualData);
    setDraft({
      ...draft,
      courseSourceMode: "grade",
      annualCourseData: nextAnnualData,
      annualCourseOrigin: "bundled",
      annualCourseVersion: annualCourseLibraryVersion,
      core: {
        ...draft.core,
        liveLessons: stageCounts.live,
        knowledgeVideos: stageCounts.video,
      },
    });
  };

  const updateGiftOverride = (key, field, value) => {
    const current = draft.giftOverrides?.[key] ?? {};
    setDraft({
      ...draft,
      giftOverrides: {
        ...(draft.giftOverrides ?? {}),
        [key]: { ...current, [field]: value },
      },
    });
  };

  const handleUploadName = async (slot, event) => {
    const file = event.target.files?.[0];
    setUploadNames((items) => ({ ...items, [slot]: file?.name ?? "" }));
    if (/^(annual|custom)-(live|video)$/.test(slot) && file) {
      const [, source, type] = slot.match(/^(annual|custom)-(live|video)$/);
      const parsed = await parseCourseWorkbook(file, type, draft.grade);
      const setter = source === "annual" ? setAnnualCourseData : setCustomCourseData;
      setter((data) => {
        const merged = { ...data, [type]: parsed };
        const phases = draft.coveragePhases?.length ? draft.coveragePhases : getDefaultCoveragePhases(draft);
        const stageCounts = getCourseStageCounts(merged, phases);
        setDraft((current) => ({
          ...current,
          ...(source === "custom" ? { courseSourceMode: "custom" } : {}),
          core: {
            ...current.core,
            liveLessons: stageCounts.live,
            knowledgeVideos: stageCounts.video,
          },
        }));
        return merged;
      });
      if (source === "annual") {
        setDraft((current) => ({
          ...current,
          annualCourseOrigin: "uploaded",
          annualCourseVersion: `uploaded-${annualCourseLibraryVersion}`,
        }));
      }
    }
    if (slot.startsWith("gift-detail-") && file) {
      const targetKey = slot.replace("gift-detail-", "");
      const parsedGift = await parseGiftWorkbook(file, draft.grade);
      const targetItem = courseGiftItems.find((item) => getGiftItemKey(item) === targetKey) ?? { type: "赠课" };
      const merged = mergeGiftUploadItem(targetItem, parsedGift);
      setDraft({
        ...draft,
        giftOverrides: {
          ...(draft.giftOverrides ?? {}),
          [targetKey]: {
            ...(draft.giftOverrides?.[targetKey] ?? {}),
            detail: merged.detail,
            value: merged.value,
            rule: merged.rule,
            subjectCourses: merged.subjectCourses,
            bullets: merged.bullets,
          },
        },
      });
    }
    if (slot === "gift" && file?.name) {
      const parsedGift = await parseGiftWorkbook(file, draft.grade);
      setLastGiftImport(parsedGift);
      const item = mergeGiftUploadItem({ type: "赠课" }, parsedGift);
      const key = getGiftItemKey(item);
      const exists = courseGiftItems.some((gift) => getGiftItemKey(gift) === key);
      const customGiftItems = (draft.customGiftItems ?? []).filter((gift) => gift.name !== item.name);
      if (exists) {
        setDraft({
          ...draft,
          giftSelections: selectedGiftKeys.includes(key) ? selectedGiftKeys : [...selectedGiftKeys, key],
        });
      } else {
        setDraft({
          ...draft,
          customGiftItems: [...customGiftItems, item],
          giftSelections: selectedGiftKeys.includes(key) ? selectedGiftKeys : [...selectedGiftKeys, key],
        });
      }
    }
  };

  const toggleCoveragePhase = (phase) => {
    const current = draft.coveragePhases?.length ? draft.coveragePhases : getDefaultCoveragePhases(draft);
    if (current.length === 1 && current.includes(phase)) return;
    const next = current.includes(phase) ? current.filter((item) => item !== phase) : [...current, phase];
    const stageCounts = getCourseStageCounts(parsedCourseData, next);
    setDraft({
      ...draft,
      coveragePhases: next,
      videoPhases: next,
      core: {
        ...draft.core,
        liveLessons: stageCounts.live,
        knowledgeVideos: stageCounts.video,
      },
    });
  };

  const updatePhysicalGiftImage = async (key, file) => {
    if (!file) return;
    const image = await readImageFileAsDataUrl(file);
    updateGiftOverride(key, "image", image);
  };

  const updateCourseGiftImage = async (key, file) => {
    if (!file) return;
    const image = await readImageFileAsDataUrl(file);
    updateGiftOverride(key, "image", image);
  };

  const updateNewGiftImage = async (file) => {
    if (!file) return;
    const image = await readImageFileAsDataUrl(file);
    setNewGift((current) => ({ ...current, image }));
  };

  const updateNewPhysicalGiftImage = async (file) => {
    if (!file) return;
    const image = await readImageFileAsDataUrl(file);
    setNewPhysicalGift((current) => ({ ...current, image }));
  };

  const toggleGiftSelection = (key) => {
    const next = selectedGiftKeys.includes(key)
      ? selectedGiftKeys.filter((item) => item !== key)
      : [...selectedGiftKeys, key];
    setDraft({ ...draft, giftSelections: next });
  };

  const addCustomGift = () => {
    if (!newGift.name.trim()) return;
    const item = {
      type: "赠课",
      name: newGift.name.trim(),
      detail: newGift.detail.trim() || "后台新增赠课明细",
      value: newGift.value.trim() || "待补充",
      lessonCount: newGift.lessonCount.trim(),
      mainContent: newGift.mainContent.trim(),
      category: newGift.category,
      rule: newGift.rule,
      image: newGift.image || "",
    };
    setDraft({
      ...draft,
      customGiftItems: [...(draft.customGiftItems ?? []), item],
      giftSelections: [...selectedGiftKeys, getGiftItemKey(item)],
    });
    setNewGift({ name: "", detail: "", value: "", lessonCount: "", mainContent: "", category: "学科类赠课", rule: "买满1科赠对应学科", image: "" });
  };

  const togglePhysicalGiftSelection = (key) => {
    const next = selectedPhysicalGiftKeys.includes(key)
      ? selectedPhysicalGiftKeys.filter((item) => item !== key)
      : [...selectedPhysicalGiftKeys, key];
    setDraft({ ...draft, physicalGiftSelections: next });
  };

  const addCustomPhysicalGift = () => {
    if (!newPhysicalGift.name.trim()) return;
    const item = {
      type: "实物赠礼",
      name: newPhysicalGift.name.trim(),
      detail: newPhysicalGift.detail.trim() || "实物赠礼明细待补充",
      value: newPhysicalGift.value.trim() || "待补充",
      rule: newPhysicalGift.rule,
      image: newPhysicalGift.image || "",
    };
    setDraft({
      ...draft,
      customPhysicalItems: [...(draft.customPhysicalItems ?? []), item],
      physicalGiftSelections: [...selectedPhysicalGiftKeys, getGiftItemKey(item)],
    });
    setNewPhysicalGift({ name: "", detail: "", value: "", rule: "买满1科赠", image: "" });
  };

  const buildDraftProduct = () => {
    const annualCourseUploadNames = { live: uploadNames.annualLive ?? "", video: uploadNames.annualVideo ?? "" };
    const customCourseUploadNames = { live: uploadNames.customLive ?? "", video: uploadNames.customVideo ?? "" };
    const resolvedCourseData = courseSourceMode === "custom" ? customCourseData : annualCourseData;
    const resolvedUploadNames = courseSourceMode === "custom" ? customCourseUploadNames : annualCourseUploadNames;
    return {
      ...draft,
      courseSourceMode,
      annualCourseData,
      annualCourseUploadNames,
      customCourseData,
      customCourseUploadNames,
      courseUploadNames: resolvedUploadNames,
      parsedCourseData: resolvedCourseData,
    };
  };

  const saveDraft = async () => {
    setSaveState("saving");
    const nextProduct = buildDraftProduct();
    const result = await onUpdate(nextProduct);
    setSaveState(result?.cloudSaved ? "saved" : "local-only");
    window.setTimeout(() => setSaveState("idle"), 1600);
    return nextProduct;
  };

  const publishDraft = async () => {
    if (!canPublish) {
      setPublishState("error");
      return;
    }
    setPublishState("publishing");
    try {
      const nextProduct = await saveDraft();
      await onPublish(nextProduct);
      setPublishState("published");
      window.setTimeout(() => setPublishState("idle"), 1800);
    } catch (error) {
      console.error(error);
      setPublishState("error");
    }
  };

  const copySalesPortalLink = async () => {
    await navigator.clipboard.writeText(buildSalesPortalUrl());
    setSalesLinkCopied(true);
    window.setTimeout(() => setSalesLinkCopied(false), 1600);
  };

  const copySupabaseSchema = async () => {
    await navigator.clipboard.writeText(supabaseSchemaSql.trim());
    setSchemaCopied(true);
    window.setTimeout(() => setSchemaCopied(false), 1800);
  };

  const createProduct = async () => {
    await onAdd();
    setActiveAdminSection("basic");
  };

  const adminSections = [
    { id: "basic", number: "01", label: "产品基础信息", description: "名称、年级、服务期与价格", icon: Settings },
    { id: "courses", number: "02", label: "正课配置", description: "全年课程库与阶段映射", icon: BookOpen },
    { id: "gifts", number: "03", label: "赠课权益", description: "通用赠课与对应学科赠课", icon: Gift },
    { id: "materials", number: "04", label: "教辅与实物", description: "图片、价值与触发门槛", icon: PackageCheck },
  ];
  const activeSectionMeta = adminSections.find((item) => item.id === activeAdminSection) ?? adminSections[0];

  return (
    <section className="workspace admin-workbench">
      <aside className="product-list admin-sidebar">
        <div className="panel-heading compact">
          <span className="eyebrow">产品库</span>
          <h1>按年级管理</h1>
        </div>
        <button className="add-product-button" type="button" onClick={createProduct}>
          <Plus size={17} />
          <span>新增产品</span>
        </button>
        <GradeProductList products={products} selectedProduct={selectedProduct} onSelect={onSelect} />
        <nav className="admin-section-nav" aria-label="后台配置模块">
          <span>当前产品配置</span>
          {adminSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                type="button"
                key={section.id}
                className={activeAdminSection === section.id ? "active" : ""}
                onClick={() => setActiveAdminSection(section.id)}
              >
                <em>{section.number}</em>
                <Icon size={17} />
                <span><strong>{section.label}</strong><small>{section.description}</small></span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="config-panel">
        <div className="preview-toolbar">
          <div>
            <span className="eyebrow">运营配置</span>
            <h2>{draft.name}</h2>
          </div>
          <div className="admin-publish-actions">
            <button className="secondary-action small" type="button" onClick={saveDraft}>
              <Save size={17} />
              <span>{saveState === "saving" ? "正在同步..." : saveState === "saved" ? "云端与销售端已同步" : saveState === "local-only" ? "同步失败，请重试" : "保存并同步"}</span>
            </button>
            <button className="secondary-action small" type="button" onClick={copySalesPortalLink}>
              <Share2 size={17} />
              <span>{salesLinkCopied ? "销售端链接已复制" : "复制销售链接"}</span>
            </button>
          </div>
        </div>

        <section className={syncStatus.includes("失败") || syncStatus.includes("本机") ? "admin-cloud-banner warning" : "admin-cloud-banner"}>
          <Database size={20} />
          <div>
            <strong>{syncStatus}</strong>
            <span>点击“保存并同步”后，配置会同时写入云端正式版本；销售和家长链接刷新后即可看到最新内容。</span>
          </div>
          <em>{cloudConfigEnabled ? "Supabase 已配置" : "仅本地模式"}</em>
          {syncStatus.includes("数据表未创建") ? (
            <button type="button" onClick={copySupabaseSchema}>
              {schemaCopied ? "建表内容已复制" : "复制一次性建表内容"}
            </button>
          ) : null}
        </section>

        <section className="admin-section-intro">
          <div><span>{activeSectionMeta.number}</span><strong>{activeSectionMeta.label}</strong></div>
          <p>{activeSectionMeta.description}</p>
          <div className={canPublish ? "admin-readiness ready" : "admin-readiness"}>
            {publishChecks.map((item) => (
              <span className={item.ready ? "ready" : "missing"} key={item.label}>
                {item.ready ? "已完成" : "待补充"} · {item.label}
              </span>
            ))}
          </div>
        </section>

        {activeAdminSection === "basic" ? <AdminPanel
          number="01"
          title="产品基础信息"
          note="配置清单首页所需的产品信息：产品、正课数量、服务期和按科目数量计算的价格。"
          icon={Settings}
        >
          <div className="form-grid">
            <Field label="产品名称">
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </Field>
            <Field label="售卖状态">
              <div className="select-wrap">
                <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                  <option>在售</option>
                  <option>暂停</option>
                  <option>待上线</option>
                </select>
                <ChevronDown size={16} />
              </div>
            </Field>
            <Field label="年级">
              <SegmentedSelect options={gradeLabels} value={draft.grade} onChange={changeProductGrade} />
            </Field>
          </div>
          <div className="number-grid">
            <Field label="学法直播">
              <input type="number" min="0" value={draft.core.liveLessons} onChange={(event) => updateCore("liveLessons", Number(event.target.value))} />
            </Field>
            <Field label="知识视频">
              <input type="number" min="0" value={draft.core.knowledgeVideos} onChange={(event) => updateCore("knowledgeVideos", Number(event.target.value))} />
            </Field>
            <Field label="直播时长">
              <input value={draft.core.liveDuration} onChange={(event) => updateCore("liveDuration", event.target.value)} />
            </Field>
            <Field label="服务周期">
              <input value={draft.core.servicePeriod} onChange={(event) => updateCore("servicePeriod", event.target.value)} />
            </Field>
          </div>
          <div className="number-grid pricing-config-grid">
            <Field label="原价 / 科">
              <input type="number" min="0" value={draft.pricing?.originalPerSubject ?? 0} onChange={(event) => updatePricing("originalPerSubject", event.target.value)} />
            </Field>
            <Field label="单科优惠价">
              <input type="number" min="0" value={draft.pricing?.singlePerSubject ?? 0} onChange={(event) => updatePricing("singlePerSubject", event.target.value)} />
            </Field>
            <Field label="两科优惠价 / 科">
              <input type="number" min="0" value={draft.pricing?.twoPerSubject ?? 0} onChange={(event) => updatePricing("twoPerSubject", event.target.value)} />
            </Field>
            <Field label="三科及以上 / 科">
              <input type="number" min="0" value={draft.pricing?.threePlusPerSubject ?? 0} onChange={(event) => updatePricing("threePlusPerSubject", event.target.value)} />
            </Field>
          </div>
        </AdminPanel> : null}

        {activeAdminSection === "courses" ? <AdminPanel
          number="02"
          title="正课权益"
          note="每个年级的全年总表只需维护一套。表格中的季度用于归档；当前产品勾选哪些阶段，销售端就只展示这些阶段的课程。"
          icon={BookOpen}
        >
          <CourseUploadBoard
            grade={draft.grade}
            annualUploadNames={{ live: uploadNames.annualLive ?? "", video: uploadNames.annualVideo ?? "" }}
            annualData={annualCourseData}
            customUploadNames={{ live: uploadNames.customLive ?? "", video: uploadNames.customVideo ?? "" }}
            customData={customCourseData}
            selectedSubject={parsedSubject}
            onSubjectChange={setParsedSubject}
            onUpload={handleUploadName}
            coveragePhases={draft.coveragePhases?.length ? draft.coveragePhases : getDefaultCoveragePhases(draft)}
            onPhaseToggle={toggleCoveragePhase}
            sourceMode={courseSourceMode}
            onSourceModeChange={changeCourseSourceMode}
          />
        </AdminPanel> : null}

        {activeAdminSection === "gifts" ? <AdminPanel
          number="03"
          title="赠课课程池"
          note="同年级重复赠课只维护一次。当前产品勾选需要赠送的课程，并配置价值、时长、明细、讲解内容和触发规则。"
          icon={Gift}
        >
          <GiftPoolSummary grade={draft.grade} total={courseGiftItems.length} selected={selectedGiftKeys.length} />
          <GiftTriggerGuide />
          <GiftOutlineTable
            items={courseGiftItems}
            selectedKeys={selectedGiftKeys}
            expandedKey={expandedGiftKey}
            uploadNames={uploadNames}
            onToggle={toggleGiftSelection}
            onExpand={(key) => setExpandedGiftKey(expandedGiftKey === key ? "" : key)}
            onUpload={handleUploadName}
            onItemChange={updateGiftOverride}
            onImageChange={updateCourseGiftImage}
          />
          <div className="gift-import-box">
            <div className="gift-import-head">
              <strong>上传九科“买即赠对应学科”课程表</strong>
              <span>一个 Excel 内可放 9 个科目。系统按工作表名或科目列解析，销售买哪科就展示哪科赠课。</span>
            </div>
            <UploadSlot label="选择九科赠课 Excel" name={uploadNames.gift} onChange={(event) => handleUploadName("gift", event)} />
            {lastGiftImport ? (
              <div className="gift-import-result">
                <Check size={16} />
                <strong>解析完成</strong>
                <span>{Object.entries(lastGiftImport.subjectCourses ?? {}).filter(([, rows]) => rows.length).map(([subject, rows]) => `${subject}${rows.length}条`).join("、") || "已读取普通赠课明细"}</span>
              </div>
            ) : null}
            <div className="gift-import-head manual-gift-head">
              <strong>手动新增普通赠课</strong>
              <span>适合选科宝典、家长成长计划等不按学科区分的赠课。</span>
            </div>
            <div className="add-gift-box">
              <input placeholder="赠课名称" value={newGift.name} onChange={(event) => setNewGift({ ...newGift, name: event.target.value })} />
              <input placeholder="课程明细 / 节数" value={newGift.detail} onChange={(event) => setNewGift({ ...newGift, detail: event.target.value })} />
              <input placeholder="价值" value={newGift.value} onChange={(event) => setNewGift({ ...newGift, value: event.target.value })} />
              <input placeholder="课时量，如 10节 × 30min" value={newGift.lessonCount} onChange={(event) => setNewGift({ ...newGift, lessonCount: event.target.value })} />
              <input placeholder="主要讲解内容" value={newGift.mainContent} onChange={(event) => setNewGift({ ...newGift, mainContent: event.target.value })} />
              <select value={newGift.category} onChange={(event) => setNewGift({ ...newGift, category: event.target.value })}>
                {giftCategoryOptions.map((category) => <option key={category}>{category}</option>)}
              </select>
              <select value={newGift.rule} onChange={(event) => setNewGift({ ...newGift, rule: event.target.value })}>
                {courseGiftRuleOptions.map((rule) => <option key={rule}>{rule}</option>)}
              </select>
              <label className="gift-image-upload">
                <ImagePlus size={17} />
                <span>{newGift.image ? "配图已选择" : "上传赠课配图"}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateNewGiftImage(event.target.files?.[0])} />
              </label>
              <button type="button" className="secondary-action" onClick={addCustomGift}><Plus size={16} />添加赠课</button>
            </div>
          </div>
        </AdminPanel> : null}

        {activeAdminSection === "materials" ? <AdminPanel
          number="04"
          title="实物赠礼 / 教辅资料"
          note="勾选当前产品包含的实物，并设置买一科即赠或满三科赠送。前台会根据销售实际勾选科目数自动判断。"
          icon={PackageCheck}
        >
          <PhysicalGiftRuleTable
            items={physicalGiftItems}
            selectedKeys={selectedPhysicalGiftKeys}
            onToggle={togglePhysicalGiftSelection}
            onItemChange={updateGiftOverride}
            onImageChange={updatePhysicalGiftImage}
          />
          <GiftTriggerGuide physical />
          <div className="gift-import-box physical-create-box">
            <div className="gift-import-head">
              <strong>新增实物赠礼</strong>
              <span>新增后进入当前年级的实物候选池，并自动勾选到当前产品。</span>
            </div>
            <div className="add-gift-box physical-add-grid">
              <input placeholder="实物名称" value={newPhysicalGift.name} onChange={(event) => setNewPhysicalGift({ ...newPhysicalGift, name: event.target.value })} />
              <input placeholder="价值" value={newPhysicalGift.value} onChange={(event) => setNewPhysicalGift({ ...newPhysicalGift, value: event.target.value })} />
              <input placeholder="赠礼明细 / 数量" value={newPhysicalGift.detail} onChange={(event) => setNewPhysicalGift({ ...newPhysicalGift, detail: event.target.value })} />
              <label className="image-upload-button">
                <ImagePlus size={16} />
                <span>{newPhysicalGift.image ? "配图已选择" : "上传赠礼配图"}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => updateNewPhysicalGiftImage(event.target.files?.[0])} />
              </label>
              <select value={newPhysicalGift.rule} onChange={(event) => setNewPhysicalGift({ ...newPhysicalGift, rule: event.target.value })}>
                {physicalGiftRuleOptions.map((rule) => <option key={rule}>{rule}</option>)}
              </select>
              <button type="button" className="secondary-action" onClick={addCustomPhysicalGift}><Plus size={16} />添加实物</button>
            </div>
          </div>
          <TeachingAidImageAdmin stage={draft.stage} />
        </AdminPanel> : null}
      </section>
    </section>
  );
}

function GradeProductList({ products, selectedProduct, onSelect }) {
  return (
    <div className="grade-product-list">
      {gradeLabels.map((grade) => {
        const gradeProducts = products.filter((product) => product.grade === grade);
        if (!gradeProducts.length) return null;
        return (
          <section className="grade-group" key={grade}>
            <header>{grade}</header>
            <div className="product-list-items">
              {gradeProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelect(product.id)}
                  className={product.id === selectedProduct.id ? "product-row active" : "product-row"}
                >
                  <strong>{product.name}</strong>
                  <span>{product.stage} · {product.status}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CourseProductBrief({ product, uploadedSubjectCount }) {
  const coverage = product.coveragePhases?.length ? product.coveragePhases : getDefaultCoveragePhases(product);
  const videoCoverage = product.videoPhases?.length ? product.videoPhases : coverage;
  return (
    <div className="product-course-brief">
      <div>
        <span>当前产品课表</span>
        <strong>{product.grade} · {product.stage}</strong>
        <p>
          后台只接收该产品对应课表。销售端选择产品和科目后，01 正课权益会自动展示对应科目的直播和知识视频。
        </p>
      </div>
      <div className="brief-chip-group">
        <em>正课阶段：{coverage.join(" + ")}</em>
        <em>视频范围：{videoCoverage.length ? videoCoverage.join(" + ") : "无知识视频"}</em>
        <em>已配置：{uploadedSubjectCount}/{courseSubjects.length}科</em>
      </div>
    </div>
  );
}

function CourseUploadBoard({ grade, annualUploadNames, annualData, customUploadNames, customData, selectedSubject, onSubjectChange, onUpload, coveragePhases, onPhaseToggle, sourceMode, onSourceModeChange }) {
  const [previewTrack, setPreviewTrack] = useState("目标班");
  const allCoursePhases = getGradeCoursePhases(grade);
  const annualLiveRows = filterCourseRowsByPhase(annualData.live?.[selectedSubject], coveragePhases);
  const annualVideoRows = filterVideoRowsByTrack(filterCourseRowsByPhase(annualData.video?.[selectedSubject], coveragePhases), previewTrack);
  const customLiveRows = filterCourseRowsByPhase(customData.live?.[selectedSubject], coveragePhases);
  const customVideoRows = filterVideoRowsByTrack(filterCourseRowsByPhase(customData.video?.[selectedSubject], coveragePhases), previewTrack);
  const annualSubjectCount = countParsedCourseSubjects(annualData);
  const customSubjectCount = countParsedCourseSubjects(customData);
  const customReady = customSubjectCount > 0;

  return (
    <div className="course-upload-board simplified-course-board">
      <section className="annual-course-panel">
        <header className="course-section-heading">
          <div>
            <span>全年课程库</span>
            <strong>{grade}全年大纲</strong>
            <small>选择阶段后，下方只展示该阶段对应的学法直播与知识视频。</small>
          </div>
          <button type="button" className={sourceMode === "grade" ? "source-state active" : "source-state"} onClick={() => onSourceModeChange("grade")}>
            <Check size={15} />当前产品使用全年大纲
          </button>
        </header>

        <div className="compact-course-files">
          <UploadSlot label="学法直播全年大纲" name={annualUploadNames.live} onChange={(event) => onUpload("annual-live", event)} />
          <UploadSlot label="知识视频全年大纲" name={annualUploadNames.video} onChange={(event) => onUpload("annual-video", event)} />
        </div>

        <div className="course-phase-config simplified">
          <div>
            <strong>筛选产品阶段</strong>
            <span>{grade === "高三" ? "选择一轮或二轮" : "可组合多个季节"}</span>
          </div>
          <div className="phase-checks">
            {allCoursePhases.map((phase) => {
              const active = coveragePhases.includes(phase);
              const liveCount = filterCourseRowsByPhase(annualData.live?.[selectedSubject], [phase]).length;
              const videoCount = filterVideoRowsByTrack(filterCourseRowsByPhase(annualData.video?.[selectedSubject], [phase]), previewTrack).length;
              return (
                <button type="button" className={active ? "active" : ""} key={phase} onClick={() => onPhaseToggle(phase)}>
                  <Check size={14} />
                  <span>{phase}<small>{liveCount}直播 / {videoCount}视频</small></span>
                </button>
              );
            })}
          </div>
        </div>

        <CoursePreviewControls selectedSubject={selectedSubject} onSubjectChange={onSubjectChange} previewTrack={previewTrack} onTrackChange={setPreviewTrack} parsedSubjectCount={annualSubjectCount} />
        <div className="course-stage-result">
          已筛选 <strong>{coveragePhases.join(" + ")}</strong>，当前科目匹配 <strong>{annualLiveRows.length} 节直播</strong>、<strong>{annualVideoRows.length} 条知识视频</strong>
        </div>
        <CourseParsedTables subject={selectedSubject} liveRows={annualLiveRows} videoRows={annualVideoRows} />
      </section>

      <section className="special-course-panel">
        <header className="course-section-heading compact">
          <div>
            <span>特殊产品</span>
            <strong>产品专属大纲</strong>
            <small>仅直通卡等特殊产品需要上传；普通产品无需操作。</small>
          </div>
          {customReady ? (
            <button type="button" className={sourceMode === "custom" ? "source-state active" : "source-state"} onClick={() => onSourceModeChange("custom")}>
              <Check size={15} />当前产品使用专属大纲
            </button>
          ) : null}
        </header>
        <div className="compact-course-files special">
          <UploadSlot label="上传专属学法直播" name={customUploadNames.live} onChange={(event) => onUpload("custom-live", event)} />
          <UploadSlot label="上传专属知识视频" name={customUploadNames.video} onChange={(event) => onUpload("custom-video", event)} />
        </div>
        {customReady ? (
          <div className="special-parse-result">
            <CoursePreviewControls selectedSubject={selectedSubject} onSubjectChange={onSubjectChange} previewTrack={previewTrack} onTrackChange={setPreviewTrack} parsedSubjectCount={customSubjectCount} compact />
            <div className="course-stage-result">
              专属表格已解析 {customSubjectCount}/9 科，当前科目共 <strong>{customLiveRows.length} 节直播</strong>、<strong>{customVideoRows.length} 条知识视频</strong>
            </div>
            <CourseParsedTables subject={selectedSubject} liveRows={customLiveRows} videoRows={customVideoRows} custom />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function filterCourseRowsByPhase(rows = [], phases = []) {
  return rows.filter((row) => phaseMatches(row.quarter, phases));
}

function countParsedCourseSubjects(data) {
  return courseSubjects.filter((subject) => data.live?.[subject]?.length || data.video?.[subject]?.length).length;
}

function CoursePreviewControls({ selectedSubject, onSubjectChange, previewTrack, onTrackChange, parsedSubjectCount, compact = false }) {
  return (
    <div className={compact ? "course-parse-preview compact" : "course-parse-preview"}>
      <div className="course-preview-toolbar">
        <strong>查看课程大纲</strong>
        <div className="course-preview-switches">
          <button type="button" className={previewTrack === "目标班" ? "active" : ""} onClick={() => onTrackChange("目标班")}>目标班</button>
          <button type="button" className={previewTrack === "菁英班" ? "active" : ""} onClick={() => onTrackChange("菁英班")}>菁英班</button>
        </div>
      </div>
      <div>
        {courseSubjects.map((subject) => (
          <button className={selectedSubject === subject ? "ready active" : "ready"} key={subject} type="button" onClick={() => onSubjectChange(subject)}>{subject}</button>
        ))}
      </div>
      <small>已解析 {parsedSubjectCount}/9 科，当前查看：{selectedSubject}</small>
    </div>
  );
}

function CourseParsedTables({ subject, liveRows, videoRows, custom = false }) {
  const prefix = custom ? "专属" : "";
  return (
    <div className="parsed-course-tables">
      <ParsedCourseTable
        title={`${subject}｜${prefix}学法直播大纲`}
        emptyText="当前筛选范围内暂无学法直播"
        columns={["阶段", "早鸟期", "一期", "二期", "三期", "课程大纲"]}
        rows={liveRows}
        renderRow={(row, index) => (
          <tr key={`${row.title}-${index}`}><td>{row.quarter || "-"}</td><td>{row.early || "-"}</td><td>{row.phase1 || "-"}</td><td>{row.phase2 || "-"}</td><td>{row.phase3 || "-"}</td><td>{row.title}</td></tr>
        )}
      />
      <ParsedCourseTable
        title={`${subject}｜${prefix}知识视频大纲`}
        emptyText="当前筛选范围内暂无知识视频"
        columns={["视频大纲", "难度星级", "是否分层", "所属阶段"]}
        rows={videoRows}
        renderRow={(row, index) => (
          <tr key={`${row.title}-${index}`}><td>{row.title}</td><td>{row.difficulty || "-"}</td><td>{row.layered || "-"}</td><td>{row.quarter || "-"}</td></tr>
        )}
      />
    </div>
  );
}

function LegacyCourseUploadBoard({ grade, uploadNames, parsedData, selectedSubject, onSubjectChange, onUpload, coveragePhases, onPhaseToggle, sourceMode, onSourceModeChange }) {
  const [previewScope, setPreviewScope] = useState("product");
  const [previewTrack, setPreviewTrack] = useState("目标班");
  const allCoursePhases = getGradeCoursePhases(grade);
  const displayPhases = previewScope === "annual" ? allCoursePhases : coveragePhases;
  const liveUploaded = Boolean(uploadNames.live);
  const videoUploaded = Boolean(uploadNames.video);
  const uploadPrefix = sourceMode === "custom" ? "custom" : "annual";
  const liveRows = (parsedData.live?.[selectedSubject] ?? []).filter((row) => phaseMatches(row.quarter, displayPhases));
  const videoRows = filterVideoRowsByTrack(
    (parsedData.video?.[selectedSubject] ?? []).filter((row) => phaseMatches(row.quarter, displayPhases)),
    previewTrack,
  );
  const selectedPhaseStats = coveragePhases.map((phase) => ({
    phase,
    live: (parsedData.live?.[selectedSubject] ?? []).filter((row) => phaseMatches(row.quarter, [phase])).length,
    video: filterVideoRowsByTrack(
      (parsedData.video?.[selectedSubject] ?? []).filter((row) => phaseMatches(row.quarter, [phase])),
      previewTrack,
    ).length,
  }));
  const emptySelectedPhases = selectedPhaseStats.filter((item) => !item.live && !item.video).map((item) => item.phase);
  const liveMissingPhases = selectedPhaseStats.filter((item) => !item.live && item.video).map((item) => item.phase);
  const videoMissingPhases = selectedPhaseStats.filter((item) => item.live && !item.video).map((item) => item.phase);
  const parsedSubjectCount = courseSubjects.filter((subject) => parsedData.live?.[subject]?.length || parsedData.video?.[subject]?.length).length;
  return (
    <div className="course-upload-board">
      <section className="course-source-picker">
        <div>
          <strong>正课来源</strong>
          <span>普通季度产品直接复用年级全年课程库；只有直通卡等特殊产品才使用专属课表。</span>
        </div>
        <div className="course-source-options">
          <button type="button" className={sourceMode === "grade" ? "active" : ""} onClick={() => onSourceModeChange("grade")}>
            <BookOpen size={17} />
            <span><strong>年级全年课程库</strong><small>推荐，选择阶段自动组合</small></span>
          </button>
          <button type="button" className={sourceMode === "custom" ? "active" : ""} onClick={() => onSourceModeChange("custom")}>
            <Upload size={17} />
            <span><strong>产品专属课表</strong><small>仅用于个性化产品</small></span>
          </button>
        </div>
      </section>
      <section className="course-link-logic">
        <div>
          <span>第一步</span>
          <strong>{sourceMode === "custom" ? "上传产品专属课表" : "维护年级全年课程库"}</strong>
          <small>{sourceMode === "custom" ? "仅当前产品使用，不影响同年级其他产品。" : "学法直播、知识视频各一份，同年级只维护一次。"}</small>
        </div>
        <ChevronDown size={18} />
        <div>
          <span>第二步</span>
          <strong>选择当前产品覆盖阶段</strong>
          <small>系统按表格“季度”字段筛选，不需要为每个产品重复上传。</small>
        </div>
        <ChevronDown size={18} />
        <div>
          <span>第三步</span>
          <strong>销售按科目展示</strong>
          <small>销售勾选几科，就展示几科在所选阶段内的课程。</small>
        </div>
      </section>
      <div className="course-phase-config">
        <div>
          <strong>当前产品覆盖阶段</strong>
          <span>至少选择一个阶段</span>
        </div>
        <div className="phase-checks">
          {allCoursePhases.map((phase) => {
            const active = coveragePhases.includes(phase);
            const liveCount = (parsedData.live?.[selectedSubject] ?? []).filter((row) => phaseMatches(row.quarter, [phase])).length;
            const videoCount = filterVideoRowsByTrack(
              (parsedData.video?.[selectedSubject] ?? []).filter((row) => phaseMatches(row.quarter, [phase])),
              previewTrack,
            ).length;
            const phaseSummary = liveCount && videoCount
              ? `${liveCount}直播 / ${videoCount}视频`
              : liveCount
                ? `${liveCount}直播 / 视频源表未提供`
                : videoCount
                  ? `直播源表未提供 / ${videoCount}视频`
                  : "源表未提供";
            return (
              <button type="button" className={active ? "active" : ""} key={phase} onClick={() => onPhaseToggle(phase)}>
                <Check size={14} />
                <span>{phase}<small>{phaseSummary}</small></span>
              </button>
            );
          })}
        </div>
      </div>
      {emptySelectedPhases.length || liveMissingPhases.length || videoMissingPhases.length ? (
        <div className="course-stage-warning">
          <strong>所选阶段的源表数据不完整</strong>
          <span>
            {emptySelectedPhases.length ? `${emptySelectedPhases.join("、")}：两份源表均未提供；` : ""}
            {liveMissingPhases.length ? `${liveMissingPhases.join("、")}：学法直播源表未提供；` : ""}
            {videoMissingPhases.length ? `${videoMissingPhases.join("、")}：知识视频源表未提供；` : ""}
            当前只统计实际解析到的 {liveRows.length} 节直播、{videoRows.length} 条知识视频。
          </span>
        </div>
      ) : (
        <div className="course-stage-result">
          当前选择共匹配 <strong>{liveRows.length} 节学法直播</strong>、<strong>{videoRows.length} 条知识视频原始大纲</strong>
        </div>
      )}
      <div className="course-upload-head">
        <strong>{sourceMode === "custom" ? "当前产品专属课表" : "年级全年正课总表"}</strong>
        <span>{sourceMode === "custom" ? "这两份表只覆盖当前产品；仍可通过上方阶段筛选销售端展示范围。" : "更新后同年级普通产品共享；各产品只需勾选覆盖阶段，不再重复上传。"}</span>
      </div>
      <CourseLibraryMatrix grade={grade} parsedData={parsedData} videoTrack={previewTrack} />
      <div className="course-upload-grid">
        <article className="course-upload-card">
          <header>
            <strong>{sourceMode === "custom" ? "专属学法直播大纲" : "学法直播全年大纲"}</strong>
            <em>{liveUploaded ? "已上传" : "待上传"}</em>
          </header>
          <UploadSlot label={sourceMode === "custom" ? "上传专属学法直播课表" : "上传学法直播全年总表"} name={uploadNames.live} onChange={(event) => onUpload(`${uploadPrefix}-live`, event)} />
        </article>
        <article className="course-upload-card">
          <header>
            <strong>{sourceMode === "custom" ? "专属知识视频大纲" : "知识视频全年大纲"}</strong>
            <em>{videoUploaded ? "已上传" : "待上传"}</em>
          </header>
          <UploadSlot label={sourceMode === "custom" ? "上传专属知识视频课表" : "上传知识视频全年总表"} name={uploadNames.video} onChange={(event) => onUpload(`${uploadPrefix}-video`, event)} />
        </article>
      </div>
      <div className="course-parse-preview">
        <div className="course-preview-toolbar">
          <strong>课程大纲核对</strong>
          <div className="course-preview-switches">
            <button type="button" className={previewScope === "product" ? "active" : ""} onClick={() => setPreviewScope("product")}>当前产品阶段</button>
            <button type="button" className={previewScope === "annual" ? "active" : ""} onClick={() => setPreviewScope("annual")}>全年全部阶段</button>
            <button type="button" className={previewTrack === "目标班" ? "active" : ""} onClick={() => setPreviewTrack("目标班")}>目标班</button>
            <button type="button" className={previewTrack === "菁英班" ? "active" : ""} onClick={() => setPreviewTrack("菁英班")}>菁英班</button>
          </div>
        </div>
        <div>
          {courseSubjects.map((subject) => (
            <button
              className={selectedSubject === subject ? "ready active" : liveUploaded || videoUploaded ? "ready" : ""}
              key={subject}
              type="button"
              onClick={() => onSubjectChange(subject)}
            >
              {subject}
            </button>
          ))}
        </div>
        <small>
          {liveUploaded || videoUploaded
            ? `已解析 ${parsedSubjectCount}/9 个科目，当前查看：${selectedSubject}`
            : "上传任一总表后，将按表内 9 个科目解析"}
        </small>
      </div>
      <div className="parsed-course-tables">
        <ParsedCourseTable
          title={`${selectedSubject}｜学法直播大纲`}
          emptyText="上传学法直播总表后，这里展示该科直播课程大纲"
          columns={["季度", "早鸟期", "一期", "二期", "三期", "课程大纲"]}
          rows={liveRows}
          renderRow={(row, index) => (
            <tr key={`${row.title}-${index}`}>
              <td>{row.quarter || "-"}</td>
              <td>{row.early || "-"}</td>
              <td>{row.phase1 || "-"}</td>
              <td>{row.phase2 || "-"}</td>
              <td>{row.phase3 || "-"}</td>
              <td>{row.title}</td>
            </tr>
          )}
        />
        <ParsedCourseTable
          title={`${selectedSubject}｜知识视频大纲`}
          emptyText="上传知识视频总表后，这里展示该科知识视频大纲"
          columns={["视频大纲", "难度星级", "是否分层", "所属季度"]}
          rows={videoRows}
          renderRow={(row, index) => (
            <tr key={`${row.title}-${index}`}>
              <td>{row.title}</td>
              <td>{row.difficulty || "-"}</td>
              <td>{row.layered || "-"}</td>
              <td>{row.quarter || "-"}</td>
            </tr>
          )}
        />
      </div>
    </div>
  );
}

function CourseLibraryMatrix({ grade, parsedData, videoTrack }) {
  const phases = getGradeCoursePhases(grade);
  return (
    <section className="course-library-matrix">
      <header>
        <div><strong>全年课程库完整度</strong><span>直接核对每科、每阶段实际解析数量</span></div>
        <em>知识视频：通用 + {videoTrack}</em>
      </header>
      <div className="course-matrix-scroll">
        <table>
          <thead><tr><th>科目</th>{phases.map((phase) => <th key={phase}>{phase}</th>)}</tr></thead>
          <tbody>
            {courseSubjects.map((subject) => (
              <tr key={subject}>
                <th>{subject}</th>
                {phases.map((phase) => {
                  const live = (parsedData.live?.[subject] ?? []).filter((row) => phaseMatches(row.quarter, [phase])).length;
                  const video = filterVideoRowsByTrack(
                    (parsedData.video?.[subject] ?? []).filter((row) => phaseMatches(row.quarter, [phase])),
                    videoTrack,
                  ).length;
                  return <td className={live || video ? "has-data" : "missing-data"} key={phase}><strong>{live}</strong><span>直播</span><strong>{video}</strong><span>视频</span></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small>显示 0 的位置代表当前上传源表中没有对应课程，不会自动使用其他阶段内容替代。</small>
    </section>
  );
}

function ParsedCourseTable({ title, columns, rows, emptyText, renderRow }) {
  return (
    <section className="parsed-course-table">
      <header>
        <strong>{title}</strong>
        <em>{rows.length}条</em>
      </header>
      {rows.length ? (
        <div className="parsed-table-scroll">
          <table>
            <thead>
              <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>{rows.slice(0, 80).map(renderRow)}</tbody>
          </table>
        </div>
      ) : (
        <div className="parsed-empty">{emptyText}</div>
      )}
    </section>
  );
}

function CourseSubjectAccordion({ plans, expandedSubject, onSubjectToggle, expandedLessonId, onLessonToggle, onLessonChange }) {
  return (
    <div className="course-subject-list">
      {plans.map((plan) => {
        const expanded = expandedSubject === plan.subject;
        const matchedCount = plan.lessons.reduce((sum, lesson) => sum + (lesson.videos?.length ?? 0), 0);
        return (
          <article className={expanded ? "course-subject-card active" : "course-subject-card"} key={plan.subject}>
            <button type="button" className="course-subject-head" onClick={() => onSubjectToggle(plan.subject)}>
              <div>
                <strong>{plan.subject}</strong>
                <span>{plan.lessons.length ? `${plan.lessons.length}节学法直播` : "课表待上传"}</span>
              </div>
              <div className="subject-overview-summary">
                <em>{plan.videoEntitlement ? `${plan.videoEntitlement}节权益视频` : "无知识视频"}</em>
                <em>{matchedCount ? `已排列${matchedCount}条` : "待自动匹配"}</em>
              </div>
              <ChevronDown size={16} />
            </button>
            {expanded ? (
              <CourseAdminEditor
                coursePlan={plan}
                expandedLessonId={expandedLessonId}
                onToggle={onLessonToggle}
                onLessonChange={(lessonId, patch) => onLessonChange(plan.subject, lessonId, patch)}
                density="compact"
              />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function AdminPanel({ number, title, note, icon: Icon, children }) {
  return (
    <section className="admin-panel">
      <header className="admin-panel-head">
        <div>
          <span>{number}</span>
          <strong>{title}</strong>
        </div>
        <Icon size={18} />
      </header>
      <p>{note}</p>
      <div className="admin-panel-body">{children}</div>
    </section>
  );
}

function UploadSlot({ label, name, onChange }) {
  return (
    <label className="upload-slot">
      <Upload size={18} />
      <span>{label}</span>
      <strong>{name || "选择表格文件"}</strong>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={onChange} />
    </label>
  );
}

function GiftPoolSummary({ grade, total, selected }) {
  return (
    <div className="gift-pool-summary">
      <div>
        <span>现有年级赠课</span>
        <strong>{grade}赠课池</strong>
      </div>
      <em>{selected}/{total} 已选</em>
    </div>
  );
}

function GiftTriggerGuide({ physical = false }) {
  return (
    <div className="gift-trigger-guide">
      <div><span>销售选 1 科</span><strong>显示“买满1科赠”</strong></div>
      <ChevronDown size={16} />
      <div><span>销售选 2 科</span><strong>同时显示满1科、满2科赠礼</strong></div>
      <ChevronDown size={16} />
      <div><span>销售选 3 科及以上</span><strong>显示全部满足门槛的{physical ? "实物" : "赠课"}</strong></div>
    </div>
  );
}

function GiftOutlineTable({ items, selectedKeys, expandedKey, uploadNames, onToggle, onExpand, onUpload, onItemChange, onImageChange }) {
  if (!items.length) {
    return (
      <div className="admin-empty">
        <Gift size={20} />
        <strong>赠课大纲待上传</strong>
        <span>上传赠课大纲后，会按“名称、价值、课程明细、赠送规则”进入表格，可再选择是否赠送给当前产品。</span>
      </div>
    );
  }

  return (
    <div className="gift-outline-table">
      <div className="gift-outline-head">
        <span />
        <strong>名称</strong>
        <strong>价值</strong>
        <strong>课程明细</strong>
        <strong>赠送规则</strong>
        <strong>操作</strong>
      </div>
      {items.map((item) => {
        const key = getGiftItemKey(item);
        const selected = selectedKeys.includes(key);
        const expanded = expandedKey === key;
        const category = getGiftCategory(item);
        return (
          <article className={expanded ? "gift-outline-row expanded" : "gift-outline-row"} key={key}>
            <div className="gift-outline-main">
              <button type="button" className={selected ? "table-check active" : "table-check"} onClick={() => onToggle(key)}>
                <Check size={13} />
              </button>
              <strong>{item.name}<small className={`gift-category-badge category-${category === "升学赋能包" ? "growth" : "subject"}`}>{category}</small></strong>
              <span>{item.value}</span>
              <span>{item.detail}</span>
              <em>{normalizeCourseGiftRule(item.rule)}</em>
              <button type="button" className="outline-detail-button" onClick={() => onExpand(key)}>
                <Pencil size={14} />{expanded ? "完成编辑" : "编辑信息"}
              </button>
            </div>
            {expanded ? (
              <div className="gift-outline-detail">
                <div className="gift-edit-fields">
                  <label><span>赠课名称</span><input value={item.name || ""} onChange={(event) => onItemChange(key, "name", event.target.value)} /></label>
                  <label><span>权益价值</span><input value={item.value || ""} onChange={(event) => onItemChange(key, "value", event.target.value)} /></label>
                  <label><span>课时量</span><input placeholder="例如：10节 × 30min" value={item.lessonCount || ""} onChange={(event) => onItemChange(key, "lessonCount", event.target.value)} /></label>
                  <label><span>赠课分类</span><select value={category} onChange={(event) => onItemChange(key, "category", event.target.value)}>
                    {giftCategoryOptions.map((option) => <option key={option}>{option}</option>)}
                  </select></label>
                  <label><span>赠送规则</span><select value={normalizeCourseGiftRule(item.rule)} onChange={(event) => onItemChange(key, "rule", event.target.value)}>
                    {courseGiftRuleOptions.map((rule) => <option key={rule}>{rule}</option>)}
                  </select></label>
                  <label className="wide"><span>课程明细</span><textarea rows="2" value={item.detail || ""} onChange={(event) => onItemChange(key, "detail", event.target.value)} /></label>
                  <label className="wide"><span>主要讲解内容</span><textarea rows="3" value={item.mainContent || item.bullets?.join("\n") || ""} onChange={(event) => onItemChange(key, "mainContent", event.target.value)} /></label>
                </div>
                <div className="gift-detail-upload">
                  <label className="gift-edit-image">
                    {getGiftImage(item) ? <img src={assetUrl(getGiftImage(item))} alt="" /> : <ImagePlus size={22} />}
                    <span>点击替换赠课配图</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onImageChange(key, event.target.files?.[0])} />
                  </label>
                  <strong>重新上传课程明细</strong>
                  <span>可替换为新的九科表格；名称、价值也可以直接在左侧修改。</span>
                  <UploadSlot
                    label="上传赠课详情"
                    name={uploadNames[`gift-detail-${key}`]}
                    onChange={(event) => onUpload(`gift-detail-${key}`, event)}
                  />
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function GiftAdminList({ items, selectedKeys, onToggle }) {
  if (!items.length) {
    return (
      <div className="admin-empty">
        <Gift size={20} />
        <strong>赠课明细待配置</strong>
        <span>上传赠课明细表或手动添加后，可在这里勾选是否赠送。</span>
      </div>
    );
  }

  return (
    <div className="gift-admin-list">
      {items.map((item) => {
        const key = getGiftItemKey(item);
        const selected = selectedKeys.includes(key);
        return (
          <button
            type="button"
            key={key}
            className={selected ? "gift-admin-row active" : "gift-admin-row"}
            onClick={() => onToggle(key)}
          >
            <span className="check-dot"><Check size={13} /></span>
            <strong>{item.name}</strong>
            <small>{item.detail}</small>
            <em>{item.value}｜{item.rule}</em>
          </button>
        );
      })}
    </div>
  );
}

function PhysicalGiftAdmin({ items, selectedKeys, onToggle, stage }) {
  return (
    <div className="physical-admin-wrap">
      <GiftAdminList items={items} selectedKeys={selectedKeys} onToggle={onToggle} />
      <TeachingAidAutoSummary stage={stage} />
    </div>
  );
}

function PhysicalGiftRuleTable({ items, selectedKeys, onToggle, onItemChange, onImageChange }) {
  if (!items.length) {
    return <div className="admin-empty"><PackageCheck size={20} /><strong>实物赠礼待配置</strong><span>在下方新增实物并设置触发规则。</span></div>;
  }
  return (
    <div className="physical-rule-table">
      <div className="physical-rule-head"><span /><strong>配图</strong><strong>实物名称</strong><strong>价值</strong><strong>赠礼明细</strong><strong>触发规则</strong></div>
      {items.map((item) => {
        const key = getGiftItemKey(item);
        const selected = selectedKeys.includes(key);
        return (
          <div className={selected ? "physical-rule-row selected" : "physical-rule-row"} key={key}>
            <button type="button" className={selected ? "table-check active" : "table-check"} onClick={() => onToggle(key)}><Check size={13} /></button>
            <label className="physical-image-cell">
              {item.image ? <img src={assetUrl(item.image)} alt="" /> : <ImagePlus size={18} />}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onImageChange(key, event.target.files?.[0])} />
            </label>
            <input aria-label="实物名称" value={item.name || ""} onChange={(event) => onItemChange(key, "name", event.target.value)} />
            <input aria-label="实物价值" value={item.value || ""} onChange={(event) => onItemChange(key, "value", event.target.value)} />
            <input aria-label="赠礼明细" value={item.detail || ""} onChange={(event) => onItemChange(key, "detail", event.target.value)} />
            <select aria-label="触发规则" value={normalizePhysicalRule(item.rule)} onChange={(event) => onItemChange(key, "rule", event.target.value)}>
              {physicalGiftRuleOptions.map((rule) => <option key={rule}>{rule}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );
}

function normalizeCourseGiftRule(rule) {
  return `买满${getGiftRuleThreshold(rule)}科赠对应学科`;
}

function normalizePhysicalRule(rule) {
  return `买满${getGiftRuleThreshold(rule)}科赠`;
}

function TeachingAidImageAdmin({ stage }) {
  return (
    <div className="teaching-aid-admin">
      <div className="course-upload-head">
        <strong>按购买科目自动展示</strong>
        <span>这里保留教辅图片配置效果；销售选择语文、数学等科目后，清单只展示对应科目的教辅资料。</span>
      </div>
      <div className="teaching-aid-admin-grid">
        {courseSubjects.map((subject) => {
          const items = getTeachingAidItems(subject, stage);
          return (
            <article className="teaching-aid-admin-card" key={subject}>
              <header>
                <strong>{subject}</strong>
                <em>{items.length ? `${items.length}项` : "待补充"}</em>
              </header>
              <div className="aid-admin-covers">
                {items.length ? (
                  items.slice(0, 3).map((item) => (
                    <div className="aid-admin-cover" key={`${subject}-${item.type}-${item.name}`}>
                      {item.image ? <img src={assetUrl(item.image)} alt={item.name} /> : <span>暂无封面</span>}
                      <small>{item.name}</small>
                    </div>
                  ))
                ) : (
                  <div className="aid-admin-empty">该科教辅图片待上传</div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TeachingAidAutoSummary({ stage }) {
  const subjectItems = courseSubjects.map((subject) => ({
    subject,
    items: getTeachingAidItems(subject, stage),
  }));
  const total = subjectItems.reduce((sum, item) => sum + item.items.length, 0);
  return (
    <div className="auto-aid-box">
      <div className="auto-aid-title">
        <strong>教辅资料自动展示</strong>
        <span>不用在后台逐科勾选；销售选择科目后，清单自动带出该科教辅封面和规则。</span>
      </div>
      <div className="auto-aid-grid">
        {subjectItems.map(({ subject, items }) => (
          <em key={subject}>{subject}｜{items.length ? `${items.length}项` : "待补充"}</em>
        ))}
      </div>
      <small>当前阶段可识别教辅共 {total} 项。</small>
    </div>
  );
}

function LayoutPage({ products, product, selectedSubjects, coursePlans }) {
  const previewRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  const exportImage = async () => {
    if (!previewRef.current || exporting) return;
    setExporting(true);
    try {
      await exportElementAsPng(previewRef.current, `${product.name}-长图版权益清单.png`);
    } catch (error) {
      console.error(error);
      window.alert("长图生成失败，请稍后重试。");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="workspace layout-workspace">
      <div className="layout-intro">
        <div>
          <span className="eyebrow">视觉排布</span>
          <h1>权益清单长图</h1>
          <p>面向家长阅读，先看价值总览，再看赠送内容，最后看课程明细。</p>
        </div>
        <button className="primary-action" type="button" onClick={exportImage} disabled={exporting}>
          <Download size={18} />
          <span>{exporting ? "生成中..." : "导出长图"}</span>
        </button>
      </div>
      <BenefitSheet products={products} product={product} coursePlans={coursePlans} refNode={previewRef} mode="poster" />
    </section>
  );
}

async function exportElementAsPng(element, filename) {
  await waitForExportAssets(element);
  element.classList.add("is-exporting");
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  let canvas;
  try {
    const isSummaryExport = element.classList.contains("view-summary");
    const exportOptions = {
      backgroundColor: isSummaryExport ? "#fdfbf7" : "#eaf5ff",
      scale: isSummaryExport ? 1 : 2,
      useCORS: true,
      allowTaint: false,
      foreignObjectRendering: false,
      imageTimeout: 15000,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth,
    };

    if (isSummaryExport) {
      const hero = element.querySelector(":scope > .envelope-hero");
      const summarySections = [...element.querySelectorAll(":scope > .letter-body > .summary-layout > *")]
        .filter((section) => window.getComputedStyle(section).display !== "none");
      const sections = summarySections.length
        ? summarySections
        : [...element.querySelectorAll(":scope > .letter-body > *")]
          .filter((section) => window.getComputedStyle(section).display !== "none");
      const segments = [hero, ...sections].filter(Boolean);
      const rendered = [];
      for (const segment of segments) {
        rendered.push(await html2canvas(segment, {
          ...exportOptions,
          width: segment.scrollWidth,
          height: segment.scrollHeight,
          windowHeight: segment.scrollHeight,
        }));
      }
      canvas = document.createElement("canvas");
      canvas.width = Math.max(...rendered.map((item) => item.width));
      canvas.height = rendered.reduce((sum, item) => sum + item.height, 0);
      const context = canvas.getContext("2d");
      context.fillStyle = "#fdfbf7";
      context.fillRect(0, 0, canvas.width, canvas.height);
      let offsetY = 0;
      rendered.forEach((item) => {
        context.drawImage(item, 0, offsetY);
        offsetY += item.height;
      });
    } else {
      canvas = await html2canvas(element, {
        ...exportOptions,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowHeight: element.scrollHeight,
      });
    }
  } finally {
    element.classList.remove("is-exporting");
  }
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
  if (!blob) throw new Error("Canvas export failed");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
}

async function waitForExportAssets(element) {
  await document.fonts?.ready;
  const images = [...element.querySelectorAll("img")];
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }));
}

function BenefitSheet({ products = [], product, coursePlan, coursePlans, refNode, mode, viewMode = "summary" }) {
  const plans = coursePlans?.length ? coursePlans : coursePlan ? [coursePlan] : [];
  const subjects = plans.length ? plans.map((plan) => plan.subject) : ["数学"];
  const giftPlan = getGiftPlanForSubjects(product, subjects, products);
  const physicalGiftItems = getPhysicalGiftItemsForSubjects(product, subjects);

  return (
    <article className={`${mode === "poster" ? "benefit-sheet poster" : "benefit-sheet"} view-${viewMode}`} ref={refNode}>
      <section className="envelope-hero">
        <div className="envelope-back" />
        <div className="letter-paper">
          <div className="sheet-brand">
            <img src={assetUrl("/assets/youdao-logo.png")} alt="网易有道领世" />
            <span>{product.term}</span>
          </div>
          <div className="hero-content">
            <div>
              <span className="product-kicker">{product.grade} · {product.stage}</span>
              <h1>{product.name}</h1>
              <p className="claim-line">请查收你的专属权益清单</p>
              <div className="hero-tags">
                <span><BookOpen size={15} />课程权益</span>
                <span><Gift size={15} />赠课权益</span>
                <span><FileText size={15} />教辅讲义</span>
              </div>
              <p>{product.subtitle}</p>
            </div>
            <img className="hero-symbol" src={assetUrl("/assets/youdao-symbol-cutout.png")} alt="" />
          </div>
        </div>
        <div className="envelope-front" />
        <img className="seal" src={assetUrl("/assets/wax-seal-cutout.png")} alt="" />
      </section>

      <section className="letter-body">
        {viewMode === "summary" ? (
          <SummaryBenefitLayout
            product={product}
            plans={plans}
            giftPlan={giftPlan}
            physicalGiftItems={physicalGiftItems}
            subjects={subjects}
          />
        ) : null}

        <EnvelopeSection number="01" title="正课权益" tone="blue">
          {plans.length ? (
            <>
              <div className="multi-course-stack">
                {plans.map((plan) => {
                  const coreLessons = plan?.lessons ?? [];
                  const videoCount = getCourseVideoRows(plan).length || plan.videoEntitlement || 0;
                  return (
                    <details
                      className={`subject-course-details${viewMode === "detail" ? " detail-static" : ""}`}
                      key={`${viewMode}-${plan.subject}`}
                      open={viewMode === "detail" ? true : undefined}
                    >
                      <summary>
                        <div>
                          <strong>{plan.subject}</strong>
                          <span>学法直播 {coreLessons.length || plan.liveCount || 0}节</span>
                        </div>
                        <div className="subject-course-summary-meta">
                          {videoCount ? <em>知识视频 {videoCount}条</em> : <em>本阶段无知识视频</em>}
                          {viewMode === "detail" ? null : <ChevronDown size={18} />}
                        </div>
                      </summary>
                      <div className="subject-course-detail-body">
                        {viewMode === "detail" ? (
                          <CourseDetailOverview product={product} plan={plan} subjects={plans.map((item) => item.subject)} />
                        ) : (
                          <div className="course-list-header">
                            <div>
                              <strong>{plan.subject}正课大纲</strong>
                            </div>
                            <em><PlayCircle size={15} />{videoCount ? "学法直播大纲 + 知识视频大纲" : "学法直播大纲"}</em>
                          </div>
                        )}
                        <CourseOutlineSplit coursePlan={plan} lessons={coreLessons} />
                        {!coreLessons.length ? <CourseOverview product={product} coursePlan={plan} /> : null}
                        {viewMode === "detail" ? (
                          <div className="detail-course-service">
                            <GraduationCap size={18} />
                            <strong>辅导老师</strong>
                            <span>购买即享 {product.core.servicePeriod} 专属伴学服务，包含答疑、学习提醒与阶段复盘</span>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  );
                })}
              </div>
              <div className="coverage-strip">
                <PlayCircle size={17} />
                <strong>学法直播负责提分方法，知识视频独立补充基础；按所购科目展示对应课程大纲</strong>
              </div>
            </>
          ) : (
            <>
              <div className="course-badges">
                <span><PlayCircle size={16} />学法直播：{product.core.liveLessons}节 x {product.core.liveDuration}</span>
                <span><Clock size={16} />上课时间：20:30-22:30</span>
                <span><PackageCheck size={16} />配套：同步知识视频</span>
              </div>
              <div className="lesson-grid">
                {product.lessons.map((lesson) => (
                  <div className="lesson-item" key={lesson.no}>
                    <span>{lesson.no}</span>
                    <strong>{lesson.live}</strong>
                    <small>{lesson.videos.join(" / ")}</small>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="section-note">{product.salesNote}</p>
        </EnvelopeSection>

        <EnvelopeSection number="02" title="赠课权益" tone="orange">
          <GiftRuleList giftPlan={giftPlan} />
        </EnvelopeSection>

        <EnvelopeSection number="03" title="实物赠礼 / 教辅资料" tone="blue">
          <div className="benefit-disclosure-body customer-gift-materials">
            <PhysicalGiftSection items={physicalGiftItems} />
            <TeachingAidSection subjects={subjects} stage={product.stage} />
          </div>
        </EnvelopeSection>

        <section className="notice-box">
          <h3><FileText size={17} />说明</h3>
          <ol>
            <li>正课部分按已选科目展示：{subjects.join("、")}。</li>
            <li>赠课及资料用于辅助学习，开放时间以班主任或官方通知为准。</li>
            <li>纸质资料依据卡型加赠，具体发放规则以实际权益为准。</li>
            <li>本清单用于说明所选产品权益，课程安排及礼品发放以官方通知为准。</li>
          </ol>
          <img src={assetUrl("/assets/youdao-symbol-cutout.png")} alt="" />
        </section>
      </section>
    </article>
  );
}

function SummaryBenefitLayout({ product, plans, giftPlan, physicalGiftItems, subjects }) {
  const [activeSubjectState, setActiveSubject] = useState(subjects[0] || plans[0]?.subject || "数学");
  const activeSubject = subjects.includes(activeSubjectState) ? activeSubjectState : (subjects[0] || plans[0]?.subject || "数学");
  const activePlan = plans.find((plan) => plan.subject === activeSubject) || plans[0] || {};
  const pricing = getProductPricing(product, subjects);
  const teachingAidItems = subjects.flatMap((subject) =>
    getTeachingAidItems(subject, product.stage).map((item) => ({ ...item, subject, summaryType: "教辅资料" })),
  );
  const teachingAidCount = teachingAidItems.length;
  const decoratedPhysicalItems = physicalGiftItems.map((item) => decorateGiftItem(item, { category: "实物赠送" }));
  const hasDraftNotebook = teachingAidCount > 0 || decoratedPhysicalItems.some((item) => `${item.name}${item.detail}`.includes("草稿本"));
  const summaryTeachingAidItem = hasDraftNotebook ? [{
    type: "教辅资料",
    name: `${subjects.join("、")}随课教辅与习题草稿本`,
    detail: `${teachingAidCount || subjects.length}项资料，按所购学科匹配`,
    value: "随课配套",
    rule: getTeachingAidRule(product.stage),
    image: "/assets/gifts/draft-notebooks.png",
    category: "实物赠送",
    summaryType: "教辅资料",
  }] : [];
  const summaryCourseGiftItems = [...new Map(
    giftPlan.items
      .map((item) => decorateGiftItem(item, { summaryType: "赠课权益" }))
      .map((item) => [`${getGiftCategory(item)}-${item.name}`, item]),
  ).values()];
  const giftAlbumItems = [
    ...summaryCourseGiftItems,
    ...summaryTeachingAidItem,
    ...decoratedPhysicalItems
      .filter((item) => !`${item.name}${item.detail}`.includes("草稿本"))
      .map((item) => ({ ...item, summaryType: "实物赠礼" })),
  ];
  const subjectGiftItems = giftAlbumItems.filter((item) => getGiftCategory(item) === "学科类赠课");
  const growthGiftItems = giftAlbumItems.filter((item) => getGiftCategory(item) === "升学赋能包");
  const tangibleGiftItems = giftAlbumItems.filter((item) => getGiftCategory(item) === "实物赠送");
  const liveCount = activePlan.lessons?.length || activePlan.liveCount || 0;
  const videoRows = getCourseVideoRows(activePlan);
  const videoCount = videoRows.length || activePlan.videoEntitlement || 0;
  const originalTotal = pricing.originalTotal;
  const discountTotal = Math.max(0, originalTotal - pricing.currentTotal);

  return (
    <div className="summary-layout reference-summary-layout">
      <section className="reference-course-overview">
        <header className="reference-heading">
          <span>课程权益明细</span>
        </header>
        <nav className="reference-subject-tabs" aria-label="选择查看科目">
          {subjects.map((subject) => (
            <button
              className={subject === activeSubject ? "active" : ""}
              key={subject}
              onClick={() => setActiveSubject(subject)}
              type="button"
            >
              {subject}
            </button>
          ))}
        </nav>
        <div className="reference-overview-grid">
          <article className="reference-rights-card">
            <h2>{activeSubject}学科正课权益</h2>
            <div className="reference-rights-list">
              <p><i className="is-live"><PlayCircle size={15} /></i><span>学法直播</span><strong>{liveCount}节</strong></p>
              <p><i className="is-video"><BookOpen size={15} /></i><span>知识视频</span><strong>{videoCount ? `${videoCount}节` : "无"}</strong></p>
              <p><i className="is-service"><GraduationCap size={15} /></i><span>辅导服务</span><strong>{product.core.servicePeriod || "以开通为准"}</strong></p>
              <p><i className="is-period"><Clock size={15} /></i><span>课程周期</span><strong>{product.term || product.stage}</strong></p>
            </div>
            <footer>
              <p><b>正课课时</b><span>核心知识视频{videoCount}节 + 学法直播{liveCount}节</span></p>
              <p><b>辅导老师</b><span>专属伴学答疑、学习提醒与阶段复盘</span></p>
            </footer>
          </article>

          <aside className="reference-price-card">
            <span>{product.stage} · {activeSubject}</span>
            <p>原价 <del>¥{formatPrice(originalTotal)}</del><em>限时优惠</em></p>
            <strong>¥{formatPrice(pricing.currentTotal)}</strong>
            <small>已选 {subjects.length} 科：{subjects.join("、")}</small>
            <div>查看完整权益</div>
          </aside>
        </div>
      </section>

      <SummaryReferenceGiftSection
        className="course-gifts"
        items={subjectGiftItems}
        subjectCount={subjects.length}
        title="课程权益"
      />
      <SummaryReferenceGiftSection
        className="growth-gifts"
        items={growthGiftItems}
        title="升学服务与成长内容"
      />
      <SummaryReferenceGiftSection
        className="physical-gifts"
        items={tangibleGiftItems}
        title="实物赠礼"
      />
      <footer className="reference-summary-footer">
        <p>课程安排与赠礼发放以官方通知为准</p>
        <span>© 2026 网易有道领世</span>
      </footer>
    </div>
  );
}

function SummaryReferenceGiftSection({ title, items, className = "", subjectCount = 0 }) {
  if (!items.length) return null;
  return (
    <section className={`reference-gift-section ${className}`}>
      <header className="reference-heading">
        <span>{title}{subjectCount ? ` · 赠${subjectCount}科` : ""}</span>
      </header>
      <div className="reference-gift-grid">
        {items.map((item, index) => {
          const image = getGiftImage(item);
          const lessonCount = className === "physical-gifts" ? "" : getGiftLessonCount(item);
          return (
            <article key={item._displayKey || `${title}-${item.name}-${index}`}>
              {image ? (
                <div className="reference-gift-image">
                  {item.value ? <em>价值 {item.value}</em> : null}
                  <img src={assetUrl(image)} alt={item.name} />
                </div>
              ) : null}
              <div className="reference-gift-copy">
                <header><strong>{item.name}</strong>{lessonCount ? <b>{lessonCount}</b> : null}</header>
                <p>{getGiftMainContent(item)}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function getJourneyTasks(item, index) {
  const taskTitles = index === 0
    ? ["诊断查漏", "方法转化", "超前预热"]
    : ["课内高度同步", "解题套路提炼", "全科学习闭环"];
  const descriptions = index === 0
    ? ["精准筛查知识盲区，针对性补齐基础。", "建立高中主动学习与思维模式。", "提前感知核心重点，平稳衔接新阶段。"]
    : ["紧贴学校教学进度，保障校内成绩稳步提升。", "提炼高效得分方法，攻克典型易错点。", "讲练评全面结合，形成稳定学习闭环。"];
  return taskTitles.map((title, taskIndex) => ({ title, description: descriptions[taskIndex] || item.description }));
}

function summarizeCourseTitles(titles) {
  if (!titles.length) return "课程内容将随学习进度陆续开放";
  const visible = titles.slice(0, 3);
  return `${visible.join("、")}${titles.length > visible.length ? ` 等${titles.length}项` : ""}`;
}

function getGiftLessonCount(item) {
  if (item.lessonCount) return item.lessonCount;
  const compactCount = String(item.detail || "").match(
    /(\d+(?:\.\d+)?\s*(?:节|讲|套|册|本|项)(?:\s*[*×xX]\s*\d+(?:\.\d+)?\s*(?:h|min|分钟|小时))?)/i,
  );
  if (compactCount) return compactCount[1].replace(/\s+/g, "");
  return "";
}

function getPhysicalGiftQuantity(item) {
  const text = `${item.quantity || ""} ${item.detail || ""} ${item.mainContent || ""}`;
  const quantity = text.match(/(\d+\s*(?:份|套|本|册|件|项))/);
  return quantity ? quantity[1].replace(/\s+/g, "") : "1份";
}

function getGiftMainContent(item) {
  if (item.mainContent) return String(item.mainContent).split(/\n+/).filter(Boolean).slice(0, 3).join("；");
  if (item.bullets?.length) return item.bullets.slice(0, 3).join("；");
  return item.detail || "围绕核心学习任务提供专项支持";
}

function getProductJourney(product) {
  if (product.stage === "秋实卡") {
    return [
      { title: "升高一 暑假", role: "黄金窗口　提前布局", description: "系统复盘初高衔接内容，补齐薄弱环节，同时提前预习高一重点知识，为新学期的难度升级做好准备。" },
      { title: "高一上 秋季", role: "进阶拔高　实现突破", description: "进入高中知识难度、综合性和学习强度提升阶段。学法直播讲透提分方法，知识视频及时补足基础，逐步建立知识体系。", current: true },
    ];
  }
  return [
    { title: "基础衔接", role: "扫清障碍", description: "梳理前置知识与学习方法，为新阶段课程做好准备。" },
    { title: product.stage, role: "系统学习", description: product.subtitle, current: true },
    { title: "阶段复盘", role: "巩固提升", description: "复盘关键知识与方法，查漏补缺并衔接下一学习阶段。" },
  ];
}

function getProductPricing(product, subjectsOrCount) {
  const selectedSubjects = Array.isArray(subjectsOrCount) ? subjectsOrCount : [];
  const subjectCount = selectedSubjects.length || Number(subjectsOrCount) || 1;
  const source = product.pricing ?? {};
  const originalPerSubject = Number(source.originalPerSubject) || 5400;
  const singlePerSubject = Number(source.singlePerSubject) || 3980;
  const twoPerSubject = Number(source.twoPerSubject) || 3680;
  const threePlusPerSubject = Number(source.threePlusPerSubject) || 3380;
  const selectedPerSubject = subjectCount === 1 ? singlePerSubject : subjectCount === 2 ? twoPerSubject : threePlusPerSubject;
  const humanities = new Set(["历史", "地理", "政治"]);
  const standardCount = selectedSubjects.length ? selectedSubjects.filter((subject) => !humanities.has(subject)).length : subjectCount;
  const humanitiesCount = selectedSubjects.length ? selectedSubjects.filter((subject) => humanities.has(subject)).length : 0;
  const humanitiesOriginal = Number(product.humanitiesPricing?.originalPerSubject) || originalPerSubject;
  const humanitiesCurrent = Number(product.humanitiesPricing?.fixedPerSubject) || selectedPerSubject;
  return {
    originalPerSubject,
    selectedPerSubject,
    originalTotal: originalPerSubject * standardCount + humanitiesOriginal * humanitiesCount,
    currentTotal: selectedPerSubject * standardCount + humanitiesCurrent * humanitiesCount,
    getSubjectOriginal: (subject) => humanities.has(subject) ? humanitiesOriginal : originalPerSubject,
    getSubjectCurrent: (subject) => humanities.has(subject) ? humanitiesCurrent : selectedPerSubject,
    tiers: [
      { label: "单科", subjects: 1, perSubject: singlePerSubject, total: singlePerSubject, active: subjectCount === 1 },
      { label: "联报两科", subjects: 2, perSubject: twoPerSubject, total: twoPerSubject * 2, active: subjectCount === 2 },
      { label: "联报三科", subjects: 3, perSubject: threePlusPerSubject, total: threePlusPerSubject * Math.max(subjectCount, 3), active: subjectCount >= 3 },
    ],
  };
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function BenefitDisclosure({ title, description, children, open = false, staticOpen = false }) {
  return (
    <details className={`benefit-disclosure${staticOpen ? " detail-static" : ""}`} open={open ? true : undefined}>
      <summary>
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        {staticOpen ? null : <ChevronDown size={19} />}
      </summary>
      <div className="benefit-disclosure-body">{children}</div>
    </details>
  );
}

function getNumericValue(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function TeachingAidSection({ subject, subjects, stage }) {
  if (subjects?.length) {
    return (
      <div className="teaching-aid-subject-stack">
        {subjects.map((item) => (
          <TeachingAidSingleSection subject={item} stage={stage} key={item} />
        ))}
      </div>
    );
  }
  return <TeachingAidSingleSection subject={subject} stage={stage} />;
}

function TeachingAidSingleSection({ subject, stage }) {
  const aidItems = getTeachingAidItems(subject, stage);
  const rule = getTeachingAidRule(stage);
  const gridSize = aidItems.length === 1 ? "single" : aidItems.length === 2 ? "pair" : aidItems.length === 3 ? "trio" : "many";

  if (!aidItems.length) {
    return (
      <div className="gift-empty">
        <FileText size={22} />
        <strong>{subject}随课教辅</strong>
        <span>该学科随课资料以实际发放为准。</span>
      </div>
    );
  }

  return (
    <div className="teaching-aid-wrap">
      <div className="teaching-aid-head">
        <div>
          <strong>{subject}随课教辅</strong>
          <span>{rule}</span>
        </div>
        <em>{aidItems.length}项资料</em>
      </div>
      <div className={`teaching-aid-grid ${gridSize}`}>
        {aidItems.map((item, index) => (
          <TeachingAidCard item={item} index={index} rule={rule} key={`${item.type}-${item.name}`} />
        ))}
      </div>
      <div className="coverage-strip">
        <FileText size={17} />
        <strong>购买对应学科后，可获得该学科匹配的随课教辅资料</strong>
      </div>
    </div>
  );
}

function PhysicalGiftSection({ items }) {
  if (!items.length) return null;
  return (
    <div className="physical-gift-section">
      <div className="teaching-aid-head">
        <div>
          <strong>文创 / 书籍 / 实物</strong>
          <span>精选实体礼品，为学习增添仪式感。</span>
        </div>
        <em>{items.length}项</em>
      </div>
      <SupportGiftGrid items={items} />
    </div>
  );
}

function TeachingAidCard({ item, index, rule }) {
  return (
    <article className="teaching-aid-card">
      <em className="aid-index">{String(index + 1).padStart(2, "0")}</em>
      <div className="aid-cover">
        {item.image ? <img src={assetUrl(item.image)} alt={item.name} /> : <span>{item.name}</span>}
      </div>
      <div className="aid-info">
        <span>{item.type}</span>
        <strong>{item.name}</strong>
        <p>{rule}</p>
      </div>
    </article>
  );
}

function CourseAdminEditor({ coursePlan, expandedLessonId, onToggle, onLessonChange }) {
  if (!coursePlan.lessons.length) {
    return (
      <div className="gift-empty course-admin-empty">
        <ListChecks size={22} />
        <strong>当前阶段暂无课程明细</strong>
        <span>上传该产品课表后，会按模块、课程名称、季度自动排成大纲表。</span>
      </div>
    );
  }

  return (
    <div className="course-outline-table">
      <div className="course-outline-head">
        <span />
        <strong>模块</strong>
        <strong>分值</strong>
        <strong>课程名称</strong>
        <strong>是否分层</strong>
        <strong>难度星级</strong>
        <strong>所属季度</strong>
        <strong>操作</strong>
      </div>
      {coursePlan.lessons.map((lesson) => (
        <CourseOutlineRow
          lesson={lesson}
          expanded={expandedLessonId === lesson.id}
          onToggle={() => onToggle(expandedLessonId === lesson.id ? "" : lesson.id)}
          onLessonChange={onLessonChange}
          key={lesson.id}
        />
      ))}
    </div>
  );
}

function CourseOutlineRow({ lesson, expanded, onToggle, onLessonChange }) {
  const videoText = lesson.videos?.map((video) => (typeof video === "string" ? video : video.title)).join("\n") ?? "";
  const hasLayer = Boolean(lesson.videos?.length);
  const difficulty = lesson.difficulty ?? getLessonDifficulty(lesson);
  const valueText = lesson.value ?? getLessonValue(lesson);

  return (
    <article className={expanded ? "course-outline-row expanded" : "course-outline-row"}>
      <div className="course-outline-main" onClick={onToggle}>
        <span className="outline-check" />
        <span>学法直播</span>
        <span>{valueText}</span>
        <strong>{lesson.live}</strong>
        <span>{hasLayer ? "是" : "否"}</span>
        <span className="difficulty-stars">{"★".repeat(difficulty)}</span>
        <span>{lesson.quarter ?? "待定"}</span>
        <span className="outline-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" title="编辑" onClick={onToggle}>
            <Pencil size={18} />
          </button>
          <button type="button" title="删除" className="danger" onClick={() => onLessonChange(lesson.id, { deleted: true })}>
            <Trash2 size={18} />
          </button>
        </span>
      </div>
      {expanded ? (
        <div className="course-outline-detail">
          <Field label="课程名称">
            <input value={lesson.live ?? ""} onChange={(event) => onLessonChange(lesson.id, { live: event.target.value })} />
          </Field>
          <Field label="分值 / 时长">
            <input value={valueText} onChange={(event) => onLessonChange(lesson.id, { value: event.target.value })} />
          </Field>
          <Field label="日期">
            <input value={lesson.date ?? ""} onChange={(event) => onLessonChange(lesson.id, { date: event.target.value })} />
          </Field>
          <Field label="上课时间">
            <input value={lesson.time ?? ""} onChange={(event) => onLessonChange(lesson.id, { time: event.target.value })} />
          </Field>
          <Field label="难度星级">
            <div className="select-wrap">
              <select value={difficulty} onChange={(event) => onLessonChange(lesson.id, { difficulty: Number(event.target.value) })}>
                <option value={1}>★</option>
                <option value={2}>★★</option>
                <option value={3}>★★★</option>
              </select>
              <ChevronDown size={16} />
            </div>
          </Field>
          <Field label="所属季度">
            <input value={lesson.quarter ?? ""} onChange={(event) => onLessonChange(lesson.id, { quarter: event.target.value })} />
          </Field>
          <Field label="配套知识视频">
            <textarea
              rows="5"
              value={videoText}
              onChange={(event) => {
                const videos = event.target.value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean)
                  .map((title, index) => ({ title, id: `${lesson.id}-custom-video-${index}` }));
                onLessonChange(lesson.id, { videos });
              }}
            />
          </Field>
        </div>
      ) : null}
    </article>
  );
}

async function parseCourseWorkbook(file, type, grade) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  return parseCourseWorkbookSheets({
    SheetNames: workbook.SheetNames,
    Sheets: workbook.Sheets,
    sheetToRows: (sheet) => XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }),
  }, type, grade, courseSubjects);
}

async function readImageFileAsDataUrl(file) {
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
  const maxWidth = 1200;
  const scale = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

async function parseGiftWorkbook(file, grade) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const subjectCourses = Object.fromEntries(courseSubjects.map((subject) => [subject, []]));
  const allTexts = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    rows.forEach((row) => {
      row.forEach((cell) => {
        const text = normalizeGiftText(cell);
        if (text) allTexts.push(text);
      });
    });
    collectGiftCoursesFromSheet(rows, sheetName, subjectCourses);
  });

  const cleanedSubjectCourses = Object.fromEntries(
    courseSubjects.map((subject) => [subject, uniqueStrings(subjectCourses[subject]).filter(isValidGiftCourseText)]),
  );
  const hasSubjectCourses = Object.values(cleanedSubjectCourses).some((items) => items.length);
  const fallbackBullets = hasSubjectCourses ? [] : uniqueStrings(allTexts).filter(isValidGiftCourseText).slice(0, 12);

  return {
    name: file.name.replace(/\.(xlsx|xls|csv)$/i, ""),
    detail: hasSubjectCourses ? "对应学科赠课" : fallbackBullets.length ? `${fallbackBullets.length}项课程明细` : "课程明细待补充",
    value: extractGiftValue(allTexts) || "待补充",
    rule: "买满1科赠对应学科",
    subjectCourses: hasSubjectCourses ? cleanedSubjectCourses : undefined,
    bullets: fallbackBullets.length ? fallbackBullets : undefined,
  };
}

function collectGiftCoursesFromSheet(rows, sheetName, subjectCourses) {
  const sheetSubject = courseSubjects.find((subject) => sheetName.includes(subject));
  if (sheetSubject) {
    const sheetItems = rows
      .flatMap((row) => row.map(normalizeGiftText))
      .filter((text) => text && !courseSubjects.includes(text));
    subjectCourses[sheetSubject].push(...sheetItems);
    return;
  }

  collectGiftCoursesByHeaderColumns(rows, subjectCourses);
  collectGiftCoursesBySubjectRows(rows, subjectCourses);
}

function collectGiftCoursesByHeaderColumns(rows, subjectCourses) {
  const maxColumns = Math.max(0, ...rows.map((row) => row.length));
  for (let col = 0; col < maxColumns; col += 1) {
    const columnValues = rows.map((row) => normalizeGiftText(row[col])).filter(Boolean);
    const headerText = columnValues.slice(0, 4).join(" ");
    const subject = courseSubjects.find((item) => headerText.includes(item));
    if (!subject) continue;
    const items = columnValues.filter((text) => text !== subject);
    subjectCourses[subject].push(...items);
  }
}

function collectGiftCoursesBySubjectRows(rows, subjectCourses) {
  let currentSubject = "";
  rows.forEach((row) => {
    const cells = row.map(normalizeGiftText).filter(Boolean);
    const subject = courseSubjects.find((item) => cells.includes(item));
    if (subject) currentSubject = subject;
    if (!currentSubject) return;
    const items = cells.filter((text) => text !== currentSubject);
    subjectCourses[currentSubject].push(...items);
  });
}

function mergeGiftUploadItem(item, parsedGift) {
  return {
    ...item,
    type: "赠课",
    name: item.name || parsedGift.name,
    detail: parsedGift.detail,
    value: parsedGift.value,
    rule: parsedGift.rule,
    subjectCourses: parsedGift.subjectCourses,
    bullets: parsedGift.bullets,
  };
}

function normalizeGiftText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatExcelDate(value);
  return String(value).replace(/\s+/g, " ").trim();
}

function isValidGiftCourseText(text) {
  if (!text || text.length < 2) return false;
  if (courseSubjects.includes(text)) return false;
  if (/^[\d\s.,，、;；:：\-—/]+$/.test(text)) return false;
  const exactHeaders = new Set([
    "类型",
    "对应年级",
    "具体明细",
    "价值",
    "科目",
    "学科",
    "课程",
    "课程名称",
    "课程明细",
    "赠送规则",
    "买赠规则",
    "序号",
    "名称",
    "模块",
  ]);
  if (exactHeaders.has(text)) return false;
  if (/^暑期学法知识汇总/.test(text)) return false;
  if (/^高[一二三]$/.test(text)) return false;
  if (/^第?\d+[讲节课]?$/.test(text)) return false;
  return true;
}

function extractGiftValue(texts) {
  const valueText = texts.find((text) => /[¥￥]\s*\d+|\d+\s*元/.test(text));
  return valueText?.match(/[¥￥]\s*\d+|\d+\s*元/)?.[0]?.replace(/\s+/g, "") ?? "";
}

function uniqueStrings(items) {
  return [...new Set(items.map((item) => normalizeGiftText(item)).filter(Boolean))];
}

function createHeaderIndex(header) {
  return header.reduce((map, value, idx) => {
    const key = String(value || "").trim();
    if (key) map[key] = idx;
    return map;
  }, {});
}

function getCell(row, index, key) {
  const idx = index[key];
  return idx === undefined ? "" : row[idx];
}

function formatSchedule(date, time) {
  if (!date && !time) return "";
  const dateText = formatExcelDate(date);
  const timeText = String(time || "").trim();
  return [dateText, timeText].filter(Boolean).join(" ");
}

function formatExcelDate(value) {
  if (!value) return "";
  if (value instanceof Date) return `${value.getMonth() + 1}月${value.getDate()}日`;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? `${parsed.m}月${parsed.d}日` : String(value);
  }
  return String(value).trim();
}

function resolveCoursePlan(product, subject, forcedPhases, videoTrack = "目标班") {
  const profile = { ...getSubjectProfile(product, subject) };
  const isG1Autumn = String(product.grade).includes("高一") && `${product.stage}${product.name}`.includes("秋实");
  if (isG1Autumn && ["语文", "数学", "英语", "物理", "化学"].includes(subject)) {
    profile.knowledgeVideos = 40;
  }
  const parsedPlan = resolveParsedCoursePlan(product, subject, profile, forcedPhases, videoTrack);
  if (parsedPlan) return parsedPlan;

  const basePlan = courseCatalog[product.grade]?.[subject] ?? null;

  if (basePlan) {
    const shouldClearVideos = profile.knowledgeVideos === 0;
    const coveragePhases = forcedPhases?.length ? forcedPhases : product.coveragePhases?.length ? product.coveragePhases : getDefaultCoveragePhases(product);
    const videoPhases = getVideoCoveragePhases(product, coveragePhases);
    const rawLessons = basePlan.lessons.filter((lesson) => phaseMatches(lesson.quarter, coveragePhases));
    const phaseVideoRows = shouldClearVideos
      ? []
      : basePlan.videoLibrary.filter((video) => phaseMatches(video.quarter, videoPhases));
    const videoPool = filterVideoRowsByTrack(phaseVideoRows, videoTrack)
      .slice(0, profile.knowledgeVideos || undefined);
    const assignedLessons = assignVideosToLessons(rawLessons, videoPool);
    const lessons = applyCourseOverrides(assignedLessons, product, subject);
    const matchedCount = lessons.reduce((sum, lesson) => sum + (lesson.videos?.length ?? 0), 0);
    return {
      ...basePlan,
      grade: product.grade,
      stage: product.stage,
      description: product.subtitle,
      liveCount: forcedPhases?.length ? lessons.length : profile.liveLessons,
      videoEntitlement: profile.knowledgeVideos,
      videoLibraryCount: videoPool.length,
      matchedVideoCount: matchedCount,
      unmatchedVideoCount: Math.max(0, videoPool.length - matchedCount),
      videoRows: videoPool,
      videoTrack,
      videoOutlineCount: videoPool.length,
      lessons,
      summary: profile.summary,
      isPlaceholder: false,
    };
  }

  return {
    subject,
    grade: product.grade,
    stage: product.stage,
    description: product.subtitle,
    liveCount: profile.liveLessons,
    videoEntitlement: profile.knowledgeVideos,
    videoLibraryCount: profile.knowledgeVideos,
    matchedVideoCount: 0,
    unmatchedVideoCount: 0,
    videoRows: [],
    videoTrack,
    videoOutlineCount: 0,
    time: "以实际排课为准",
    lessons: product.lessons ?? [],
    unmatchedVideos: [],
    summary: profile.summary,
    isPlaceholder: true,
  };
}

function resolveParsedCoursePlan(product, subject, profile, forcedPhases, videoTrack = "目标班") {
  const liveRows = product.parsedCourseData?.live?.[subject] ?? [];
  const uploadedVideoRows = product.parsedCourseData?.video?.[subject] ?? [];
  const fallbackVideoRows = profile.knowledgeVideos
    ? courseCatalog[product.grade]?.[subject]?.videoLibrary ?? []
    : [];
  const videoRows = uploadedVideoRows.length ? uploadedVideoRows : fallbackVideoRows;
  if (!liveRows.length && !uploadedVideoRows.length) return null;

  const coveragePhases = forcedPhases?.length ? forcedPhases : product.coveragePhases?.length ? product.coveragePhases : getDefaultCoveragePhases(product);
  const filteredLive = liveRows.filter((lesson) => phaseMatches(lesson.quarter, coveragePhases));
  let filteredVideos = filterVideoRowsByTrack(
    videoRows.filter((video) => phaseMatches(video.quarter, getVideoCoveragePhases(product, coveragePhases))),
    videoTrack,
  ).slice(0, profile.knowledgeVideos || undefined);
  if (!uploadedVideoRows.length && !filteredVideos.length && fallbackVideoRows.length && profile.knowledgeVideos) {
    filteredVideos = filterVideoRowsByTrack(
      fallbackVideoRows.filter((video) => phaseMatches(video.quarter, getVideoCoveragePhases(product, coveragePhases))),
      videoTrack,
    ).slice(0, profile.knowledgeVideos || undefined);
  }
  const assignedLessons = assignVideosToLessons(
    filteredLive.map((lesson, index) => ({
      ...lesson,
      no: lesson.no ?? index + 1,
      live: lesson.live ?? lesson.title,
      videos: [],
    })),
    filteredVideos,
  );
  const lessons = applyCourseOverrides(assignedLessons, product, subject);
  const matchedCount = lessons.reduce((sum, lesson) => sum + (lesson.videos?.length ?? 0), 0);

  return {
    subject,
    grade: product.grade,
    stage: product.stage,
    description: product.subtitle,
    liveCount: lessons.length,
    videoEntitlement: filteredVideos.length,
    videoLibraryCount: filteredVideos.length,
    matchedVideoCount: matchedCount,
    unmatchedVideoCount: Math.max(0, filteredVideos.length - matchedCount),
    videoRows: filteredVideos,
    videoTrack,
    videoOutlineCount: filteredVideos.length,
    time: lessons.find((lesson) => lesson.time)?.time ?? "以实际排课为准",
    lessons,
    unmatchedVideos: [],
    summary: [`学法直播${lessons.length}节`, filteredVideos.length ? `知识视频${filteredVideos.length}条` : "无知识视频"],
    isPlaceholder: false,
  };
}

function filterVideoRowsByTrack(rows, videoTrack) {
  const normalizedRows = rows.map((row) => ({ ...row, normalizedTrack: normalizeVideoTrack(row.layered) }));
  const hasExplicitTracks = normalizedRows.some((row) => row.normalizedTrack === "目标班" || row.normalizedTrack === "菁英班");
  if (!hasExplicitTracks) return uniqueCourseRows(rows);

  return uniqueCourseRows(normalizedRows
    .filter((row) => row.normalizedTrack === "通用" || row.normalizedTrack === videoTrack)
    .map(({ normalizedTrack, ...row }) => row));
}

function uniqueCourseRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = [row.quarter, row.layered, row.title, row.name].map((value) => String(value ?? "").trim()).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeVideoTrack(value) {
  const label = String(value || "").trim();
  if (/目标/.test(label)) return "目标班";
  if (/菁英|精英/.test(label)) return "菁英班";
  return "通用";
}

function phaseMatches(phase, selectedPhases) {
  if (!String(phase || "").trim()) return true;
  if (!selectedPhases?.length) return true;
  if (selectedPhases.includes(phase)) return true;
  if (phase === "暑秋" && (selectedPhases.includes("暑期") || selectedPhases.includes("秋季"))) return true;
  if (phase === "寒春" && (selectedPhases.includes("寒假") || selectedPhases.includes("春季"))) return true;
  if (phase === "夏季" && selectedPhases.includes("暑期")) return true;
  return false;
}

function getGradeCoursePhases(grade) {
  return grade === "高三" ? ["一轮", "二轮"] : ["暑期", "秋季", "寒假", "春季"];
}

function getVideoCoveragePhases(product, coveragePhases) {
  // 全年课程库始终跟随产品覆盖阶段；仅个性化课表允许保留独立的视频范围。
  if (product.courseSourceMode === "custom" && product.videoPhases?.length) {
    return product.videoPhases;
  }
  return coveragePhases;
}

function getCourseStageCounts(parsedData, coveragePhases) {
  const counts = courseSubjects.map((subject) => {
    const live = (parsedData.live?.[subject] ?? [])
      .filter((row) => phaseMatches(row.quarter, coveragePhases)).length;
    const video = filterVideoRowsByTrack(
      (parsedData.video?.[subject] ?? [])
        .filter((row) => phaseMatches(row.quarter, coveragePhases)),
      "目标班",
    ).length;
    return { live, video };
  });
  return {
    live: Math.max(0, ...counts.map((item) => item.live)),
    video: Math.max(0, ...counts.map((item) => item.video)),
  };
}

function getDefaultCoveragePhases(product) {
  if (product.grade === "高三") {
    return product.stage === "二轮卡" ? ["二轮"] : ["一轮"];
  }
  if (product.stage === "夏研卡") return ["暑期"];
  if (product.stage === "秋实卡") return ["秋季"];
  if (product.stage === "一轮卡") return ["暑期", "秋季"];
  return ["暑期", "秋季"];
}

function assignVideosToLessons(lessons, videos) {
  if (!lessons.length) return [];
  if (!videos.length) return lessons.map((lesson) => ({ ...lesson, videos: [] }));
  const perLesson = Math.min(4, Math.max(1, Math.ceil(videos.length / lessons.length)));
  let cursor = 0;
  return lessons.map((lesson) => {
    const assigned = videos.slice(cursor, cursor + perLesson);
    cursor += perLesson;
    return { ...lesson, videos: assigned };
  });
}

function applyCourseOverrides(lessons, product, subject) {
  const overrides = product.courseOverrides?.[subject] ?? {};
  return lessons
    .map((lesson) => {
      const override = overrides[lesson.id];
      return override ? { ...lesson, ...override } : lesson;
    })
    .filter((lesson) => !lesson.deleted);
}

function getLessonDifficulty(lesson) {
  const videoCount = lesson.videos?.length ?? 0;
  if (videoCount >= 3) return 3;
  if (videoCount >= 1) return 2;
  return 1;
}

function getLessonValue(lesson) {
  if (lesson.value) return lesson.value;
  if (lesson.time?.includes("-")) return "约2h";
  return "约2h";
}

function getSubjectProfile(product, subject) {
  const group = product.humanitiesSubjects?.includes(subject) || humanitiesSubjects.includes(subject) ? "humanities" : "default";
  const profile = product.subjectProfiles?.[group] ?? product.subjectProfiles?.default;
  const isG1Autumn = String(product.grade).includes("高一") && `${product.stage}${product.name}`.includes("秋实");
  const videoSubjects = isG1Autumn
    ? ["语文", "数学", "英语", "物理", "化学"]
    : product.videoSubjects;
  const hasKnowledgeVideos = !videoSubjects || videoSubjects.includes(subject);
  const knowledgeVideos = isG1Autumn && hasKnowledgeVideos
    ? 40
    : hasKnowledgeVideos ? profile?.knowledgeVideos ?? product.core.knowledgeVideos : 0;
  return {
    liveLessons: profile?.liveLessons ?? product.core.liveLessons,
    knowledgeVideos,
    summary: profile?.summary ?? [
      `学法直播${product.core.liveLessons}节`,
      hasKnowledgeVideos && product.core.knowledgeVideos ? `知识视频${product.core.knowledgeVideos}节` : "无知识视频",
    ],
  };
}

function getGiftPlan(product, subject) {
  const basePlan = getBaseGiftPlan(product, subject);
  const courseItems = applyGiftOverrides(product, [...(basePlan?.items ?? []), ...(product.customGiftItems ?? [])])
    .filter((item) => item.type === "赠课");
  const selectedKeys = product.giftSelections;
  const selectedItems = selectedKeys ? courseItems.filter((item) => isGiftItemSelected(selectedKeys, item)) : courseItems;
  return {
    ...(basePlan ?? { title: "赠课权益", note: "赠课权益以实际开通内容为准。" }),
    items: selectedItems.map((item) => resolveSubjectGiftItem(item, subject)),
  };
}

function getGiftPlanForSubjects(product, subjects, products = []) {
  const basePlan = getBaseGiftPlan(product, subjects[0]);
  const courseItems = (products.length ? getGradeGiftCandidates(products, product) : [
    ...(basePlan?.items ?? []),
    ...(product.customGiftItems ?? []),
  ]).filter((item) => item.type === "赠课");
  const configuredCourseItems = applyGiftOverrides(product, courseItems);
  const selectedKeys = product.giftSelections;
  const selectedItems = (selectedKeys ? configuredCourseItems.filter((item) => isGiftItemSelected(selectedKeys, item)) : configuredCourseItems)
    .filter((item) => isGiftRuleEligible(item.rule, subjects.length));
  const items = selectedItems.flatMap((item) => {
    if (isSubjectMatchedGift(item)) {
      return subjects
        .filter((subject) => item.subjectCourses?.[subject]?.length)
        .map((subject) => resolveSubjectGiftItem(item, subject));
    }
    return [item];
  });
  const firstPlan = basePlan ?? { title: "赠课权益", note: "赠课权益以实际开通内容为准。" };
  return {
    ...firstPlan,
    note: subjects.length > 1 ? `已按所购科目生成赠课权益：${subjects.join("、")}` : firstPlan.note,
    items: uniqueGiftItems(items).map((item) => decorateGiftItem(item)),
  };
}

function isSubjectMatchedGift(item) {
  return Boolean(item.subjectCourses);
}

function resolveMergedSubjectGiftItem(item, subjects) {
  const subjectBullets = subjects.flatMap((subject) => {
    const courses = item.subjectCourses?.[subject] ?? [];
    return courses.length ? courses.map((course) => `${subject}｜${course}`) : [];
  });
  return {
    ...item,
    _displayKey: `${getGiftItemKey(item)}-${subjects.join("-")}`,
    detail: subjects.length > 1 ? `${subjects.join("、")}｜匹配开通` : item.detail,
    bullets: subjectBullets.length ? subjectBullets : item.bullets,
  };
}

function resolveSubjectGiftItem(item, subject) {
  if (!item.subjectCourses) return item;
  const courses = item.subjectCourses[subject] ?? [];
  if (!courses.length) {
    return {
      ...item,
      _displayKey: `${getGiftItemKey(item)}-${subject}`,
      bullets: item.bullets?.length ? item.bullets : ["该学科具体明细以实际开通内容为准"],
    };
  }
  return {
    ...item,
    _displayKey: `${getGiftItemKey(item)}-${subject}`,
    detail: `${subject}｜${item.lessonCount || item.detail || `${courses.length}项`}`,
    bullets: courses,
  };
}

function getBaseGiftPlan(product, subject) {
  if (product.id === "g1-decisive" && humanitiesSubjects.includes(subject)) {
    return giftCatalog["g1-humanities-half"] ?? giftCatalog[product.id];
  }
  return giftCatalog[product.id];
}

function getPhysicalGiftItems(product, subject) {
  const items = getAllPhysicalGiftItems(product, subject);
  const selectedKeys = product.physicalGiftSelections;
  return selectedKeys ? items.filter((item) => isGiftItemSelected(selectedKeys, item)) : items;
}

function getPhysicalGiftItemsForSubjects(product, subjects) {
  return uniqueGiftItems(subjects.flatMap((subject) => getPhysicalGiftItems(product, subject)))
    .filter((item) => isGiftRuleEligible(item.rule, subjects.length))
    .map((item) => decorateGiftItem(item, { category: "实物赠送" }));
}

function getAllPhysicalGiftItems(product, subject) {
  const basePlan = getBaseGiftPlan(product, subject);
  return applyGiftOverrides(product, [...(basePlan?.items ?? []), ...(product.customPhysicalItems ?? [])])
    .filter((item) => item.type !== "赠课");
}

function getAdminGiftCandidates(product) {
  return uniqueGiftItems(applyGiftOverrides(product, [
    ...courseSubjects.flatMap((subject) => getBaseGiftPlan(product, subject)?.items ?? []),
    ...(product.customGiftItems ?? []),
  ]));
}

function getGradeGiftCandidates(products, product) {
  return uniqueGiftItems(applyGiftOverrides(product, [
    ...products
      .filter((item) => item.grade === product.grade)
      .flatMap((item) => getAdminGiftCandidates(item)),
    ...(product.customGiftItems ?? []),
  ]));
}

function getAdminPhysicalGiftCandidates(product) {
  return uniqueGiftItems([
    ...getAdminGiftCandidates(product).filter((item) => item.type !== "赠课"),
    ...(product.customPhysicalItems ?? []),
  ]);
}

function getGradePhysicalGiftCandidates(products, product) {
  return uniqueGiftItems(applyGiftOverrides(product, [
    ...products
      .filter((item) => item.grade === product.grade)
      .flatMap((item) => getAdminPhysicalGiftCandidates(item)),
    ...(product.customPhysicalItems ?? []),
  ])).map((item) => decorateGiftItem(item, { category: "实物赠送" }));
}

function isGiftRuleEligible(rule, subjectCount) {
  return subjectCount >= getGiftRuleThreshold(rule);
}

function getGiftRuleThreshold(rule) {
  const text = String(rule || "");
  if (text.includes("两科及以下") || text.includes("直接赠送") || text.includes("买赠对应") || text.includes("买对应学科")) return 1;
  if (/买满\s*3\s*科|3科|三科/.test(text)) return 3;
  if (/买满\s*2\s*科|2科|两科/.test(text) && !text.includes("两科及以下")) return 2;
  return 1;
}

function getGiftLibraryMatch(item) {
  const text = `${item?.name ?? ""} ${item?.detail ?? ""}`;
  return giftImageLibrary.find((entry) => entry.names.some((name) => text.includes(name)));
}

function getGiftCategory(item) {
  if (item?.category && giftCategoryMeta[item.category]) return item.category;
  if (item?.type && item.type !== "赠课") return "实物赠送";
  const matched = getGiftLibraryMatch(item);
  if (matched?.category) return matched.category;
  const text = `${item?.name ?? ""} ${item?.detail ?? ""}`;
  return /选科|升学|家长|心理|规划/.test(text) ? "升学赋能包" : "学科类赠课";
}

function getGiftImage(item) {
  if (/^(data:|blob:|https?:)/.test(item?.image || "")) return item.image;
  return getGiftLibraryMatch(item)?.image || item?.image || "";
}

function decorateGiftItem(item, extra = {}) {
  return {
    ...item,
    category: getGiftCategory(item),
    image: getGiftImage(item),
    ...extra,
  };
}

function uniqueGiftItems(items) {
  const map = new Map();
  items.forEach((item) => {
    map.set(item._displayKey || getGiftItemKey(item), item);
  });
  return [...map.values()];
}

function applyGiftOverrides(product, items) {
  const overrides = product.giftOverrides ?? {};
  return items.map((item) => {
    const sourceKey = item._sourceKey || `${item.type}-${item.name}`;
    const override = overrides[sourceKey];
    return override ? { ...item, ...override, _sourceKey: sourceKey } : { ...item, _sourceKey: sourceKey };
  });
}

function getGiftItemKey(item) {
  return item._sourceKey || `${item.type}-${item.name}`;
}

function getLegacyGiftItemKey(item) {
  return `${item.type}-${item.name}-${item.detail}`;
}

function isGiftItemSelected(selectedKeys, item) {
  return selectedKeys.includes(getGiftItemKey(item)) || selectedKeys.includes(getLegacyGiftItemKey(item));
}

function normalizeSelectedGiftKeys(selectedKeys, items) {
  return items
    .filter((item) => isGiftItemSelected(selectedKeys, item))
    .map(getGiftItemKey);
}

function CourseOverview({ product, coursePlan }) {
  const summaryItems = coursePlan.summary?.length ? coursePlan.summary : [coursePlan.description];
  return (
    <div className="course-overview">
      <div className="course-overview-grid">
        <div>
          <span>学法直播</span>
          <strong>{coursePlan.liveCount}节</strong>
          <small>{product.core.liveDuration}/节</small>
        </div>
        <div>
          <span>知识视频</span>
          <strong>{coursePlan.videoEntitlement}节</strong>
          <small>{coursePlan.videoEntitlement ? `${product.core.videoDuration}/节` : "无"}</small>
        </div>
        <div>
          <span>服务期</span>
          <strong>{product.core.servicePeriod}</strong>
          <small>专属伴学服务</small>
        </div>
        <div>
          <span>视频释放</span>
          <strong>{product.videoReleasePlan ? "分批开放" : "按课程计划开放"}</strong>
          <small>{product.videoReleasePlan ?? "开放时间以官方通知为准"}</small>
        </div>
      </div>
      <div className="course-summary-lines">
        {summaryItems.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      {product.priceNote ? <p className="price-note">{product.priceNote}</p> : null}
    </div>
  );
}

function EnvelopeSection({ number, title, tone, children }) {
  return (
    <section className={`envelope-section ${tone}`}>
      <div className="number-ribbon">
        <span>{number}</span>
        <strong>{title}</strong>
      </div>
      <div className="section-card">{children}</div>
    </section>
  );
}

function CourseDetailOverview({ product, plan, subjects }) {
  const liveCount = plan.lessons?.length || plan.liveCount || 0;
  const videoCount = getCourseVideoRows(plan).length || plan.videoEntitlement || 0;
  const pricing = getProductPricing(product, subjects);
  const originalPrice = pricing.getSubjectOriginal(plan.subject);
  const currentPrice = pricing.getSubjectCurrent(plan.subject);
  return (
    <section className="detail-course-overview">
      <header>
        <div className="detail-course-identity">
          <span>{plan.subject.slice(0, 1)}</span>
          <div>
            <strong>{plan.subject}正课大纲</strong>
            <small>{videoCount ? `学法直播 + ${product.unlayeredVideoSubjects?.includes(plan.subject) ? "不分层" : plan.videoTrack || "目标班"}知识视频` : "学法直播课程"}</small>
          </div>
        </div>
        <div className="detail-course-price">
          <del>原价 ¥{formatPrice(originalPrice)}</del>
          <span>到手价</span>
          <strong>¥{formatPrice(currentPrice)}</strong>
          <em>/科</em>
        </div>
      </header>
      <div className="detail-course-metrics">
        <div><span>知识视频</span><strong>{videoCount}</strong><em>节</em><small>基础查漏与分层精讲</small></div>
        <div><span>学法直播</span><strong>{liveCount}</strong><em>节</em><small>方法教学与提分训练</small></div>
        <div><span>合计课程</span><strong>{liveCount + videoCount}</strong><em>节</em><small>本学科完整正课权益</small></div>
      </div>
    </section>
  );
}

function CourseOutlineSplit({ coursePlan, lessons }) {
  const videoRows = getCourseVideoRows(coursePlan);
  const liveRows = chunkItems(lessons, 2);
  const videoTableRows = chunkItems(videoRows, 2);
  return (
    <div className="course-outline-split">
      <section className="outline-block live">
        <header>
          <div>
            <strong>学法直播大纲</strong>
            <span>{coursePlan.subject} ｜ {lessons.length}节</span>
          </div>
          <em><BookOpen size={14} />学习主题一览</em>
        </header>
        <table className="compact-outline-table live-compact-table desktop-outline-table">
          <thead>
            <tr>
              <th>课次</th>
              <th>学法直播主题</th>
              <th>课次</th>
              <th>学法直播主题</th>
            </tr>
          </thead>
          <tbody>
            {liveRows.map((row, rowIndex) => (
              <tr key={`live-row-${rowIndex}`}>
                {row.map((lesson, index) => (
                  <Fragment key={lesson.id ?? `${lesson.no}-${lesson.live}`}>
                    <td className="outline-no">{lesson.no ?? rowIndex * 2 + index + 1}</td>
                    <td className="outline-title">{lesson.live}</td>
                  </Fragment>
                ))}
                {row.length < 2 ? <EmptyOutlineCells count={2} /> : null}
              </tr>
            ))}
          </tbody>
        </table>
        <table className="compact-outline-table live-mobile-table mobile-outline-table">
          <thead>
            <tr>
              <th>课次</th>
              <th>学法直播主题</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson, index) => (
              <tr key={`live-mobile-${lesson.id ?? `${lesson.no}-${lesson.live}`}`}>
                <td className="outline-no">{lesson.no ?? index + 1}</td>
                <td className="outline-title">{lesson.live}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {videoRows.length ? (
        <section className="outline-block video">
          <header>
            <div>
              <strong>知识视频大纲</strong>
              <span>
                {coursePlan.subject} ｜ {coursePlan.videoTrack || "目标班"} ｜ {videoRows.length}条大纲
                {coursePlan.videoEntitlement > videoRows.length ? ` / ${coursePlan.videoEntitlement}节权益` : ""}
              </span>
            </div>
            <em><PackageCheck size={14} />通用 + {coursePlan.videoTrack || "目标班"}</em>
          </header>
          <table className="compact-outline-table video-compact-table desktop-outline-table">
            <thead>
              <tr>
                <th>课次</th>
                <th>课程大纲</th>
                <th>星级难度</th>
                <th>课次</th>
                <th>课程大纲</th>
                <th>星级难度</th>
              </tr>
            </thead>
            <tbody>
              {videoTableRows.map((row, rowIndex) => (
                <tr key={`video-row-${rowIndex}`}>
                  {row.map((video, index) => (
                    <Fragment key={video.id ?? `${getVideoTitle(video)}-${rowIndex}-${index}`}>
                      <td className="outline-no">{rowIndex * 2 + index + 1}</td>
                      <td className="outline-title">{getVideoTitle(video)}</td>
                      <td className="outline-difficulty">
                        <span className="outline-stars">{formatDifficultyStars(getVideoDifficulty(video))}</span>
                      </td>
                    </Fragment>
                  ))}
                  {row.length < 2 ? <EmptyOutlineCells count={3} /> : null}
                </tr>
              ))}
            </tbody>
          </table>
          <table className="compact-outline-table video-mobile-table mobile-outline-table">
            <thead>
              <tr>
                <th>课次</th>
                <th>课程大纲</th>
                <th>难度</th>
              </tr>
            </thead>
            <tbody>
              {videoRows.map((video, index) => (
                <tr key={`video-mobile-${video.id ?? `${getVideoTitle(video)}-${index}`}`}>
                  <td className="outline-no">{index + 1}</td>
                  <td className="outline-title">{getVideoTitle(video)}</td>
                  <td className="outline-difficulty">
                    <span className="outline-stars">{formatDifficultyStars(getVideoDifficulty(video))}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

function EmptyOutlineCells({ count }) {
  return Array.from({ length: count }).map((_, index) => (
    <td className="outline-empty" key={`empty-${index}`} />
  ));
}

function chunkItems(items, size) {
  return items.reduce((rows, item, index) => {
    if (index % size === 0) rows.push([]);
    rows[rows.length - 1].push(item);
    return rows;
  }, []);
}

function getVideoTitle(video) {
  return typeof video === "string" ? video : video.title;
}

function getVideoDifficulty(video) {
  if (typeof video === "string") return "";
  return video.difficulty || "-";
}

function formatDifficultyStars(difficulty) {
  const match = String(difficulty || "").match(/\d+/);
  if (!match) return difficulty || "-";
  const count = Math.max(1, Math.min(Number(match[0]), 5));
  return "⭐️".repeat(count);
}

function flattenLessonVideos(lessons) {
  const seen = new Set();
  return lessons.flatMap((lesson) => lesson.videos ?? []).filter((video) => {
    const key = typeof video === "string" ? video : video.id ?? video.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getCourseVideoRows(coursePlan) {
  if (Array.isArray(coursePlan?.videoRows)) return coursePlan.videoRows;
  return flattenLessonVideos(coursePlan?.lessons ?? []);
}

function CourseMatrix({ lessons, showVideos }) {
  const groups = [];
  const chunkSize = !showVideos && lessons.length <= 10 ? 10 : 9;
  for (let i = 0; i < lessons.length; i += chunkSize) {
    groups.push(lessons.slice(i, i + chunkSize));
  }
  return (
    <div className="course-matrix-stack">
      {groups.map((group, index) => (
        <CourseMatrixGroup lessons={group} showVideos={showVideos} key={index} />
      ))}
    </div>
  );
}

function CourseMatrixGroup({ lessons, showVideos }) {
  const showVideoRow = showVideos && lessons.some((lesson) => lesson.videos?.length);
  return (
    <div className="course-matrix" style={{ "--lesson-count": lessons.length }}>
      <div className="matrix-label"><GraduationCap size={16} />课次</div>
      {lessons.map((lesson) => (
        <div className="matrix-cell matrix-no" key={`no-${lesson.no}`}><span>{lesson.no}</span></div>
      ))}
      <div className="matrix-label"><Clock size={16} />学法日期</div>
      {lessons.map((lesson) => (
        <div className="matrix-cell matrix-date" key={`date-${lesson.no}`}>{lesson.date ?? "-"}</div>
      ))}
      <div className="matrix-label"><PlayCircle size={16} />学法直播</div>
      {lessons.map((lesson) => (
        <div className="matrix-cell matrix-live" key={`live-${lesson.no}`}>{lesson.live}</div>
      ))}
      {showVideoRow ? (
        <>
          <div className="matrix-label tall"><PackageCheck size={16} />知识视频</div>
          {lessons.map((lesson) => (
            <div className="matrix-cell matrix-video" key={`video-${lesson.no}`}>
              {lesson.videos?.length ? lesson.videos.map((video) => (
                <span key={video.title ?? video}>{typeof video === "string" ? video : video.title}</span>
              )) : <span className="empty-video">{lesson.quarter === "暑期" ? "无知识视频" : "暂无配套视频"}</span>}
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

function BenefitTable({ rows }) {
  return (
    <table className="benefit-table">
      <thead>
        <tr>
          <th>权益模块</th>
          <th>内容</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((module) => (
          <tr key={module.id}>
            <td>{module.title}</td>
            <td>{formatModuleCount(module)}</td>
            <td>{module.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GiftRuleList({ giftPlan }) {
  if (!giftPlan?.items?.length) {
    return (
      <div className="gift-empty">
        <Gift size={22} />
        <strong>{giftPlan?.title ?? "赠课权益"}</strong>
        <span>{giftPlan?.note ?? "本产品暂无额外赠课。"}</span>
      </div>
    );
  }

  const courseItems = giftPlan.items.filter((item) => item.type === "赠课");
  const courseGroups = giftCategoryOptions
    .map((category) => ({ category, ...giftCategoryMeta[category], items: courseItems.filter((item) => getGiftCategory(item) === category) }))
    .filter((group) => group.items.length);

  return (
    <div className="gift-rule-wrap">
      <div className="detail-gift-groups">
        {courseGroups.map((group) => (
          <section className="detail-gift-group" key={group.category}>
            <header><span>{group.index}</span><div><strong>{group.category}</strong><small>{group.note}</small></div></header>
            <div className="gift-poster-grid">
              {group.items.map((item, index) => (
                <GiftPosterCard item={item} index={index} key={`${item.name}-${index}`} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function GiftPosterCard({ item, index }) {
  const tones = ["cyan", "orange", "purple", "green", "blue"];
  const tone = tones[index % tones.length];
  const showValue = item.value && !String(item.value).includes("待补充");
  const image = getGiftImage(item);
  return (
    <article className={`gift-poster-card simplified ${tone}`}>
      <div className="gift-poster-image">
        {showValue ? <em>价值 {item.value}</em> : null}
        {image ? <img src={assetUrl(image)} alt={item.name} /> : <span>{item.name}</span>}
      </div>
      <header>
        <strong>{item.name}</strong>
      </header>
      <div className="gift-poster-summary">
        <strong>{getGiftLessonCount(item)}</strong>
        <p>{getGiftMainContent(item)}</p>
        {item.bullets?.length ? (
          <div className="gift-course-outline">
            <span>课程大纲</span>
            <ol>
              {item.bullets.map((outline, outlineIndex) => (
                <li key={`${item.name}-outline-${outlineIndex}`}>{outline}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SupportGiftGrid({ items }) {
  return (
    <div className="support-gift-grid">
      {items.map((item) => (
        <div className={`support-gift-card ${item.image ? "with-image" : ""}`} key={`${item.type}-${item.name}`}>
          {item.image ? <img src={assetUrl(item.image)} alt={item.detail} /> : null}
          <span>{item.type}</span>
          <strong>{item.name}</strong>
          <small>{item.detail}</small>
          <em>{item.value}｜{item.rule}</em>
        </div>
      ))}
    </div>
  );
}

function formatModuleCount(module) {
  if (module.id === "pre-high" || module.id === "exam-review") {
    return "多学科";
  }
  return `${module.items.length}讲`;
}

function LegacyBenefitSheet({ product, refNode, mode }) {
  const giftModules = product.giftModuleIds
    .map((id) => moduleLibrary.find((module) => module.id === id))
    .filter(Boolean);

  return (
    <article className={mode === "poster" ? "benefit-sheet poster" : "benefit-sheet"} ref={refNode}>
      <section className="sheet-hero">
        <div className="sheet-brand">
          <img src={assetUrl("/assets/youdao-logo.png")} alt="网易有道领世" />
          <span>{product.term}</span>
        </div>
        <div className="hero-content">
          <div>
            <span className="product-kicker">{product.grade} · {product.stage}</span>
            <h1>{product.name}</h1>
            <p>{product.subtitle}</p>
          </div>
          <img className="hero-symbol" src={assetUrl("/assets/youdao-symbol.jpg")} alt="" />
        </div>
      </section>

      <section className="summary-band">
        <SummaryItem label="学法直播" value={`${product.core.liveLessons}节`} note={product.core.liveDuration} />
        <SummaryItem label="知识视频" value={`${product.core.knowledgeVideos}节`} note={product.core.videoDuration} />
        <SummaryItem label="辅导服务" value={product.core.servicePeriod} note="每科跟进" />
      </section>

      <section className="sheet-section">
        <SectionTitle icon={BookOpen} title="产品正课" />
        <div className="core-copy">
          <strong>
            学法直播 {product.core.liveLessons} 节（{product.core.liveDuration}/节） + 知识视频{" "}
            {product.core.knowledgeVideos} 节（{product.core.videoDuration}/节） + 辅导老师服务 {product.core.servicePeriod}/科
          </strong>
          <p>{product.salesNote}</p>
        </div>
        <div className="lesson-grid">
          {product.lessons.map((lesson) => (
            <div className="lesson-item" key={lesson.no}>
              <span>{lesson.no}</span>
              <strong>{lesson.live}</strong>
              <small>{lesson.videos.join(" / ")}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="sheet-section">
        <SectionTitle icon={ListChecks} title="课程及资料明细" />
        <div className="detail-modules">
          {giftModules.map((module) => (
            <div className="detail-module" key={module.id}>
              <h3>{module.title}</h3>
              <ul>
                {module.items.slice(0, mode === "poster" ? 8 : 5).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="sheet-footer">
        <span>有道领世 · 高效学习从有道领世开始</span>
        <span>具体权益以实际开通及合同约定为准</span>
      </footer>
    </article>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <div className="section-title">
      <Icon size={18} />
      <h2>{title}</h2>
    </div>
  );
}

function SummaryItem({ label, value, note }) {
  return (
    <div className="summary-item">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SegmentedSelect({ options, value, onChange }) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={value === option ? "active" : ""}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="metric">
      <Icon size={18} />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function buildShareUrl(product, subjects, viewMode = "summary", videoTracks = {}) {
  const isLocalPreview = ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const url = new URL(isLocalPreview ? PUBLIC_SITE_URL : window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("share", "1");
  url.searchParams.set("product", product.id);
  const subjectList = Array.isArray(subjects) ? subjects : [subjects];
  url.searchParams.set("subjects", subjectList.join(","));
  url.searchParams.set("tracks", subjectList.map((subject) => `${subject}:${videoTracks?.[subject] ?? "目标班"}`).join(","));
  url.searchParams.set("view", viewMode);
  return url.toString();
}

function buildSalesPortalUrl() {
  const isLocalPreview = ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const url = new URL(isLocalPreview ? PUBLIC_SITE_URL : window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("sales", "1");
  return url.toString();
}

createRoot(document.getElementById("root")).render(<App />);
