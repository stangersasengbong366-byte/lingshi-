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
  Eye,
  FileText,
  Gift,
  GraduationCap,
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
import "./styles.css";

const gradeLabels = ["高一", "高二", "高三"];
const stageLabels = ["夏研卡", "秋实卡", "决胜卡", "直通卡", "一轮卡"];
const humanitiesSubjects = ["生物", "历史", "地理", "政治"];
const PRODUCTS_STORAGE_KEY = "youdao-benefits-products-v5-g1-autumn-course-refresh";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
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
    if (!Array.isArray(stored) || !stored.length) return initialProducts;
    return stored.map(migrateStoredProduct);
  } catch {
    return initialProducts;
  }
}

function migrateStoredProduct(product) {
  if (!(String(product.grade).includes("高一") && `${product.stage}${product.name}`.includes("秋实"))) return product;
  return {
    ...product,
    videoSubjects: ["语文", "数学", "英语", "物理", "化学"],
    pricing: product.pricing ?? {
      originalPerSubject: 5400,
      singlePerSubject: 3980,
      twoPerSubject: 3680,
      threePlusPerSubject: 3380,
    },
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
  if (!response.ok) throw new Error("云端配置读取失败");
  const records = await response.json();
  const record = records.find((item) => item.id === configId) ?? records.find((item) => item.id === fallbackId);
  const products = Array.isArray(record?.payload?.products) ? record.payload.products : record?.payload;
  return Array.isArray(products) ? products.map(migrateStoredProduct) : null;
}

async function saveCloudProducts(products, configId = CLOUD_PRODUCTS_DRAFT_ID) {
  if (!cloudConfigEnabled) return;
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
  if (!response.ok) throw new Error("云端配置保存失败");
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
  const selectedProduct = products.find((item) => item.id === selectedProductId) ?? products[0];
  const selectedCoursePlans = selectedSubjects.map((subject) => resolveCoursePlan(selectedProduct, subject));
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
      .catch(() => setSyncStatus("云端连接失败，已使用本地配置"));
    return () => {
      cancelled = true;
    };
  }, [publicView]);

  const updateProduct = (nextProduct) => {
    setProducts((items) => {
      const nextProducts = items.map((item) => (item.id === nextProduct.id ? nextProduct : item));
      saveStoredProducts(nextProducts);
      saveCloudProducts(nextProducts, CLOUD_PRODUCTS_DRAFT_ID)
        .then(() => setSyncStatus("草稿已保存到云端"))
        .catch(() => setSyncStatus("云端保存失败，已保存在本地"));
      return nextProducts;
    });
    setSelectedProductId(nextProduct.id);
  };

  const publishProducts = async (nextProduct) => {
    const nextProducts = nextProduct
      ? products.map((item) => (item.id === nextProduct.id ? nextProduct : item))
      : products;
    await saveCloudProducts(nextProducts, CLOUD_PRODUCTS_PUBLISHED_ID);
    setSyncStatus("已发布，销售端将读取最新版本");
  };

  if (shareParams) {
    return (
      <CustomerSharePage
        products={products}
        product={selectedProduct}
        selectedSubjects={selectedSubjects}
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
          coursePlans={selectedCoursePlans}
          onSelect={setSelectedProductId}
          onSubjectsChange={setSelectedSubjects}
        />
      )}
      {activePage === "admin" && (
        <AdminPage
          products={products}
          selectedProduct={selectedProduct}
          onSelect={setSelectedProductId}
          onUpdate={updateProduct}
          onPublish={publishProducts}
        />
      )}
      {activePage === "layout" && (
        <LayoutPage products={products} product={selectedProduct} selectedSubjects={selectedSubjects} coursePlans={selectedCoursePlans} />
      )}
    </main>
  );
}

function getSalesOnlyMode() {
  return new URLSearchParams(window.location.search).get("sales") === "1";
}

function getShareParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("share") !== "1") return null;
  return {
    productId: params.get("product") || initialProducts[0].id,
    subject: params.get("subject") || "数学",
    subjects: (params.get("subjects") || params.get("subject") || "数学").split(",").map((item) => item.trim()).filter(Boolean),
    viewMode: params.get("view") === "detail" ? "detail" : "summary",
  };
}

function AppHeader({ activePage, onPageChange, syncStatus, salesOnly }) {
  const pages = [
    { id: "sales", label: "主页面", icon: Eye },
    { id: "admin", label: "后台配置", icon: Settings },
    { id: "layout", label: "权益清单", icon: FileText },
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

function SalesPage({ products, selectedProduct, selectedSubjects, coursePlans, onSelect, onSubjectsChange }) {
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
    await navigator.clipboard.writeText(buildShareUrl(selectedProduct, selectedSubjects, viewMode));
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
        <Field label="展示版本">
          <div className="version-switch" role="group" aria-label="展示版本">
            <button
              className={viewMode === "summary" ? "active" : ""}
              type="button"
              onClick={() => setViewMode("summary")}
            >
              <span>一</span>
              <div><strong>清单版本</strong><small>一页总览全部权益</small></div>
            </button>
            <button
              className={viewMode === "detail" ? "active" : ""}
              type="button"
              onClick={() => setViewMode("detail")}
            >
              <span>二</span>
              <div><strong>明细版本</strong><small>展开完整课程大纲</small></div>
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

function CustomerSharePage({ products, product, selectedSubjects, coursePlans, viewMode }) {
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
            <span>{product.name} · {selectedSubjects.join("、")}</span>
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
            <strong>{product.name} · {selectedSubjects.join("、")}</strong>
          </div>
        </div>
        <BenefitSheet products={products} product={product} coursePlans={coursePlans} mode="poster" viewMode={viewMode} />
      </section>
    </main>
  );
}

function AdminPage({ products, selectedProduct, onSelect, onUpdate, onPublish }) {
  const [draft, setDraft] = useState(selectedProduct);
  const [expandedGiftKey, setExpandedGiftKey] = useState("");
  const [uploadNames, setUploadNames] = useState({});
  const [parsedCourseData, setParsedCourseData] = useState({ live: {}, video: {} });
  const [parsedSubject, setParsedSubject] = useState("语文");
  const [newGift, setNewGift] = useState({ name: "", detail: "", value: "", rule: "直接赠送" });
  const [publishState, setPublishState] = useState("idle");
  const [salesLinkCopied, setSalesLinkCopied] = useState(false);
  const courseGiftItems = getGradeGiftCandidates(products, draft).filter((item) => item.type === "赠课");
  const defaultSelectedGiftKeys = getAdminGiftCandidates(draft).filter((item) => item.type === "赠课").map(getGiftItemKey);
  const selectedGiftKeys = normalizeSelectedGiftKeys(draft.giftSelections ?? defaultSelectedGiftKeys, courseGiftItems);

  React.useEffect(() => {
    setDraft(selectedProduct);
    setExpandedGiftKey("");
    setUploadNames(selectedProduct.courseUploadNames ?? {});
    setParsedCourseData(selectedProduct.parsedCourseData ?? { live: {}, video: {} });
    setParsedSubject("语文");
    setNewGift({ name: "", detail: "", value: "", rule: "直接赠送" });
  }, [selectedProduct]);

  const updateCore = (key, value) => {
    setDraft({ ...draft, core: { ...draft.core, [key]: value } });
  };

  const updatePricing = (key, value) => {
    setDraft({ ...draft, pricing: { ...draft.pricing, [key]: Number(value) || 0 } });
  };

  const handleUploadName = async (slot, event) => {
    const file = event.target.files?.[0];
    setUploadNames((items) => ({ ...items, [slot]: file?.name ?? "" }));
    if ((slot === "live" || slot === "video") && file) {
      const parsed = await parseCourseWorkbook(file, slot, draft.grade);
      setParsedCourseData((data) => ({ ...data, [slot]: parsed }));
    }
    if (slot.startsWith("gift-detail-") && file) {
      const targetKey = slot.replace("gift-detail-", "");
      const parsedGift = await parseGiftWorkbook(file, draft.grade);
      const nextCustomItems = (draft.customGiftItems ?? []).map((item) => {
        if (getGiftItemKey(item) !== targetKey) return item;
        return mergeGiftUploadItem(item, parsedGift);
      });
      setDraft({ ...draft, customGiftItems: nextCustomItems });
    }
    if (slot === "gift" && file?.name) {
      const parsedGift = await parseGiftWorkbook(file, draft.grade);
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
      rule: newGift.rule,
    };
    setDraft({
      ...draft,
      customGiftItems: [...(draft.customGiftItems ?? []), item],
      giftSelections: [...selectedGiftKeys, getGiftItemKey(item)],
    });
    setNewGift({ name: "", detail: "", value: "", rule: "直接赠送" });
  };

  const saveDraft = () => {
    const nextProduct = {
      ...draft,
      courseUploadNames: uploadNames,
      parsedCourseData,
    };
    onUpdate(nextProduct);
    return nextProduct;
  };

  const publishDraft = async () => {
    const nextProduct = saveDraft();
    setPublishState("publishing");
    try {
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

  return (
    <section className="workspace admin-workbench">
      <aside className="product-list admin-sidebar">
        <div className="panel-heading compact">
          <span className="eyebrow">产品库</span>
          <h1>按年级管理</h1>
        </div>
        <button className="add-button" type="button" title="新建产品">
          <Plus size={17} />
          <span>新建产品</span>
        </button>
        <GradeProductList products={products} selectedProduct={selectedProduct} onSelect={onSelect} />
      </aside>

      <section className="config-panel">
        <div className="preview-toolbar">
          <div>
            <span className="eyebrow">运营配置</span>
            <h2>{draft.name}</h2>
          </div>
          <div className="admin-publish-actions">
            <button className="secondary-action small" type="button" onClick={copySalesPortalLink}>
              <Share2 size={17} />
              <span>{salesLinkCopied ? "销售端链接已复制" : "复制销售端链接"}</span>
            </button>
            <button className="secondary-action small" type="button" onClick={saveDraft}>
              <Save size={17} />
              <span>保存草稿</span>
            </button>
            <button className="primary-action small" type="button" onClick={publishDraft} disabled={publishState === "publishing"}>
              <Upload size={17} />
              <span>{publishState === "publishing" ? "发布中..." : publishState === "published" ? "已发布" : publishState === "error" ? "发布失败" : "发布到销售端"}</span>
            </button>
          </div>
        </div>

        <AdminPanel
          number="00"
          title="产品配置"
          note="先确定年级、班型、状态和销售话术，再进入 01/02/03 配权益。"
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
              <SegmentedSelect options={gradeLabels} value={draft.grade} onChange={(grade) => setDraft({ ...draft, grade })} />
            </Field>
            <Field label="阶段包装">
              <SegmentedSelect options={stageLabels} value={draft.stage} onChange={(stage) => setDraft({ ...draft, stage })} />
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
          <Field label="销售讲解话术">
            <textarea rows="3" value={draft.salesNote} onChange={(event) => setDraft({ ...draft, salesNote: event.target.value })} />
          </Field>
        </AdminPanel>

        <AdminPanel
          number="01"
          title="正课权益"
          note="仅上传两份总表：学法直播大纲、知识视频大纲。每份文档内包含 9 个科目，系统解析后按销售选择科目展示。"
          icon={BookOpen}
        >
          <CourseUploadBoard
            uploadNames={uploadNames}
            parsedData={parsedCourseData}
            selectedSubject={parsedSubject}
            onSubjectChange={setParsedSubject}
            onUpload={handleUploadName}
          />
        </AdminPanel>

        <AdminPanel
          number="02"
          title="赠课权益"
          note="顶部是当前年级已有赠课池，勾选即赠送；下方上传或新增后，会回到顶部候选池继续勾选。"
          icon={Gift}
        >
          <GiftPoolSummary grade={draft.grade} total={courseGiftItems.length} selected={selectedGiftKeys.length} />
          <GiftOutlineTable
            items={courseGiftItems}
            selectedKeys={selectedGiftKeys}
            expandedKey={expandedGiftKey}
            uploadNames={uploadNames}
            onToggle={toggleGiftSelection}
            onExpand={(key) => setExpandedGiftKey(expandedGiftKey === key ? "" : key)}
            onUpload={handleUploadName}
          />
          <div className="gift-import-box">
            <div className="gift-import-head">
              <strong>上传新的赠课信息</strong>
              <span>上传后会进入上方赠课池，并默认勾选到当前产品。</span>
            </div>
            <UploadSlot label="上传赠课明细表" name={uploadNames.gift} onChange={(event) => handleUploadName("gift", event)} />
            <div className="add-gift-box">
              <input placeholder="赠课名称" value={newGift.name} onChange={(event) => setNewGift({ ...newGift, name: event.target.value })} />
              <input placeholder="课程明细 / 节数" value={newGift.detail} onChange={(event) => setNewGift({ ...newGift, detail: event.target.value })} />
              <input placeholder="价值" value={newGift.value} onChange={(event) => setNewGift({ ...newGift, value: event.target.value })} />
              <select value={newGift.rule} onChange={(event) => setNewGift({ ...newGift, rule: event.target.value })}>
                <option>直接赠送</option>
                <option>买一科即赠</option>
                <option>买两科及以上赠送</option>
                <option>买对应学科赠对应学科</option>
                <option>累计3科及以上可以赠</option>
                <option>累计科目数获赠</option>
              </select>
              <button type="button" className="secondary-action" onClick={addCustomGift}><Plus size={16} />添加赠课</button>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel
          number="03"
          title="教辅资料"
          note="保留教辅图片配置。销售选择/用户购买哪个科目，权益清单就展示哪个科目的教辅资料。"
          icon={PackageCheck}
        >
          <TeachingAidImageAdmin stage={draft.stage} />
        </AdminPanel>
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

function CourseUploadBoard({ uploadNames, parsedData, selectedSubject, onSubjectChange, onUpload }) {
  const liveUploaded = Boolean(uploadNames.live);
  const videoUploaded = Boolean(uploadNames.video);
  const liveRows = parsedData.live?.[selectedSubject] ?? [];
  const videoRows = parsedData.video?.[selectedSubject] ?? [];
  const parsedSubjectCount = courseSubjects.filter((subject) => parsedData.live?.[subject]?.length || parsedData.video?.[subject]?.length).length;
  return (
    <div className="course-upload-board">
      <div className="course-upload-head">
        <strong>上传正课总表</strong>
        <span>学法直播和知识视频各上传一份表格，表内包含 9 个科目；用户买多科时，清单自动取对应科目的内容。</span>
      </div>
      <div className="course-upload-grid">
        <article className="course-upload-card">
          <header>
            <strong>学法直播大纲</strong>
            <em>{liveUploaded ? "已上传" : "待上传"}</em>
          </header>
          <UploadSlot label="上传学法直播总表" name={uploadNames.live} onChange={(event) => onUpload("live", event)} />
        </article>
        <article className="course-upload-card">
          <header>
            <strong>知识视频大纲</strong>
            <em>{videoUploaded ? "已上传" : "待上传"}</em>
          </header>
          <UploadSlot label="上传知识视频总表" name={uploadNames.video} onChange={(event) => onUpload("video", event)} />
        </article>
      </div>
      <div className="course-parse-preview">
        <strong>表格解析科目</strong>
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

function GiftOutlineTable({ items, selectedKeys, expandedKey, uploadNames, onToggle, onExpand, onUpload }) {
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
        return (
          <article className={expanded ? "gift-outline-row expanded" : "gift-outline-row"} key={key}>
            <div className="gift-outline-main">
              <button type="button" className={selected ? "table-check active" : "table-check"} onClick={() => onToggle(key)}>
                <Check size={13} />
              </button>
              <strong>{item.name}</strong>
              <span>{item.value}</span>
              <span>{item.detail}</span>
              <em>{item.rule}</em>
              <button type="button" className="outline-detail-button" onClick={() => onExpand(key)}>
                {expanded ? "收起详情" : "赠课详情"}
              </button>
            </div>
            {expanded ? (
              <div className="gift-outline-detail">
                <div>
                  <strong>上传具体课程明细</strong>
                  <span>用于补充该赠课的讲次、课程内容、适用科目或详细发放说明。</span>
                </div>
                <UploadSlot
                  label="上传赠课详情"
                  name={uploadNames[`gift-detail-${key}`]}
                  onChange={(event) => onUpload(`gift-detail-${key}`, event)}
                />
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
    canvas = await html2canvas(element, {
      backgroundColor: "#eaf5ff",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      foreignObjectRendering: false,
      imageTimeout: 15000,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });
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
        ) : (
          <BenefitOverview
            product={product}
            plans={plans}
            giftPlan={giftPlan}
            physicalGiftItems={physicalGiftItems}
            subjects={subjects}
          />
        )}

        <EnvelopeSection number="01" title="正课权益" tone="blue">
          {plans.length ? (
            <>
              <div className="multi-course-stack">
                {plans.map((plan) => {
                  const coreLessons = plan?.lessons ?? [];
                  const videoCount = getCourseVideoRows(plan).length || plan.videoEntitlement || 0;
                  return (
                    <details
                      className="subject-course-details"
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
                          <span>点击展开完整大纲</span>
                          <ChevronDown size={18} />
                        </div>
                      </summary>
                      <div className="subject-course-detail-body">
                        <div className="course-list-header">
                          <div>
                            <strong>{plan.subject}正课大纲</strong>
                            <span>{plan.time || "以实际排课为准"}</span>
                          </div>
                          <em><PlayCircle size={15} />{videoCount ? "学法直播大纲 + 知识视频大纲" : "学法直播大纲"}</em>
                        </div>
                        <CourseOutlineSplit coursePlan={plan} lessons={coreLessons} />
                        {!coreLessons.length ? <CourseOverview product={product} coursePlan={plan} /> : null}
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
          <BenefitDisclosure
            title={`已配置 ${giftPlan.items.length} 项赠课`}
            description="赠课名称、价值及赠送规则已汇总，点击查看完整课程明细。"
            open={viewMode === "detail"}
          >
            <GiftRuleList giftPlan={giftPlan} />
          </BenefitDisclosure>
        </EnvelopeSection>

        <EnvelopeSection number="03" title="实物赠礼 / 教辅资料" tone="blue">
          <BenefitDisclosure
            title={`已匹配 ${subjects.join("、")} 教辅资料`}
            description="买哪科展示哪科资料，实物赠礼与教辅图片点击展开查看。"
            open={viewMode === "detail"}
          >
            <PhysicalGiftSection items={physicalGiftItems} />
            <TeachingAidSection subjects={subjects} stage={product.stage} />
          </BenefitDisclosure>
        </EnvelopeSection>

        <section className="notice-box">
          <h3><FileText size={17} />说明</h3>
          <ol>
            <li>正课部分按已选科目展示：{subjects.join("、")}。</li>
            <li>赠课及资料用于辅助学习，开放时间以班主任或官方通知为准。</li>
            <li>纸质资料依据卡型加赠，具体发放规则以实际权益为准。</li>
            <li>海报信息仅用于产品权益说明，最终以系统开通页面为准。</li>
          </ol>
          <img src={assetUrl("/assets/youdao-symbol-cutout.png")} alt="" />
        </section>
      </section>
    </article>
  );
}

function SummaryBenefitLayout({ product, plans, giftPlan, physicalGiftItems, subjects }) {
  const subjectCount = subjects.length;
  const liveCount = plans.reduce((sum, plan) => sum + (plan.lessons?.length || plan.liveCount || 0), 0);
  const videoCount = plans.reduce((sum, plan) => sum + (getCourseVideoRows(plan).length || plan.videoEntitlement || 0), 0);
  const pricing = getProductPricing(product, subjectCount);
  const journey = getProductJourney(product);
  const teachingAidCount = subjects.reduce((sum, subject) => sum + getTeachingAidItems(subject, product.stage).length, 0);

  return (
    <div className="summary-layout">
      <section className="summary-stage-section">
        <header>
          <div>
            <span>{product.term}</span>
            <h2>{product.grade}{product.stage} · 学习阶段与作用</h2>
          </div>
          <em>从衔接到体系，再到复盘提升</em>
        </header>
        <div className="summary-stage-flow">
          {journey.map((item, index) => (
            <div className={item.current ? "summary-stage-item current" : "summary-stage-item"} key={item.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
              <em>{item.role}</em>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="summary-main-grid">
        <section className="summary-core-section">
          <header>
            <div>
              <span>正课内容</span>
              <h2>{subjects.join("、")} · 学法直播与知识视频组合学习</h2>
            </div>
            <em>{subjectCount}科权益</em>
          </header>
          <div className="summary-course-metrics">
            <div><span>学法直播</span><strong>{liveCount}节</strong><small>{product.core.liveDuration}/节</small></div>
            <div><span>知识视频</span><strong>{videoCount}条</strong><small>{product.core.videoDuration}/节</small></div>
            <div><span>服务周期</span><strong>{product.core.servicePeriod}</strong><small>以系统开通为准</small></div>
          </div>
          <div className="summary-course-explain">
            <p><strong>学法直播</strong><span>大招教学与提分方法，帮助学生建立解题框架，掌握核心题型。</span></p>
            <p><strong>知识视频</strong><span>针对直播中不熟的基础点随时补习，形成“直播提分 + 视频补基”。</span></p>
            <p><strong>学习服务</strong><span>按所购科目开通对应课程与资料，辅导老师伴学跟进。</span></p>
          </div>
        </section>

        <section className="summary-price-section">
          <header>
            <div>
              <span>购买科数价格</span>
              <h2>已选 {subjectCount} 科</h2>
            </div>
            <em>多科联报更优惠</em>
          </header>
          <div className="summary-price-list">
            {pricing.tiers.map((tier) => (
              <div className={tier.active ? "summary-price-tier active" : "summary-price-tier"} key={tier.label}>
                <span>{tier.label}</span>
                <div><small>原价/科</small><s>¥{formatPrice(pricing.originalPerSubject)}</s></div>
                <div><small>优惠后/科</small><strong>¥{formatPrice(tier.perSubject)}</strong></div>
                <div><small>{tier.active ? `${subjectCount}科实付` : "套餐总价"}</small><em>¥{formatPrice(tier.total)}</em></div>
              </div>
            ))}
          </div>
          <p>当前选择：{subjects.join("、")}，预计实付 <strong>¥{formatPrice(pricing.currentTotal)}</strong></p>
        </section>
      </div>

      <section className="summary-gift-section">
        <header>
          <div>
            <span>报名赠送</span>
            <h2>本次可获得的赠课权益</h2>
          </div>
          <em>共 {giftPlan.items.length} 项赠课 · {teachingAidCount} 项教辅{physicalGiftItems.length ? ` · ${physicalGiftItems.length} 项实物/文创` : ""}</em>
        </header>
        <div className="summary-gift-list">
          {giftPlan.items.map((item) => (
            <div key={getGiftItemKey(item)}>
              <Gift size={17} />
              <strong>{item.name}</strong>
              <span>{item.rule || "按产品规则赠送"}</span>
              <em>{item.value || "权益赠送"}</em>
            </div>
          ))}
        </div>
        <p><PackageCheck size={16} />教辅资料按所购科目自动匹配，买哪科展示并赠送哪科资料。</p>
      </section>
    </div>
  );
}

function getProductJourney(product) {
  if (product.stage === "秋实卡") {
    return [
      { title: "初高衔接", role: "夯实基础", description: "回顾初高衔接知识，扫清基础障碍，为秋季学习铺平道路。" },
      { title: "秋季体系学习", role: "构建框架", description: "学法直播讲透提分方法，知识视频及时补足基础，逐步建立高中知识体系。", current: true },
      { title: "阶段复盘", role: "查漏提升", description: "围绕本学期重点内容查漏补缺，沉淀方法，为后续学习做好衔接。" },
    ];
  }
  return [
    { title: "基础衔接", role: "扫清障碍", description: "梳理前置知识与学习方法，为新阶段课程做好准备。" },
    { title: product.stage, role: "系统学习", description: product.subtitle, current: true },
    { title: "阶段复盘", role: "巩固提升", description: "复盘关键知识与方法，查漏补缺并衔接下一学习阶段。" },
  ];
}

function getProductPricing(product, subjectCount) {
  const source = product.pricing ?? {};
  const originalPerSubject = Number(source.originalPerSubject) || 5400;
  const singlePerSubject = Number(source.singlePerSubject) || 3980;
  const twoPerSubject = Number(source.twoPerSubject) || 3680;
  const threePlusPerSubject = Number(source.threePlusPerSubject) || 3380;
  const selectedPerSubject = subjectCount === 1 ? singlePerSubject : subjectCount === 2 ? twoPerSubject : threePlusPerSubject;
  return {
    originalPerSubject,
    currentTotal: selectedPerSubject * subjectCount,
    tiers: [
      { label: "单科", perSubject: singlePerSubject, total: singlePerSubject, active: subjectCount === 1 },
      { label: "联报两科", perSubject: twoPerSubject, total: twoPerSubject * 2, active: subjectCount === 2 },
      { label: "三科及以上", perSubject: threePlusPerSubject, total: threePlusPerSubject * Math.max(subjectCount, 3), active: subjectCount >= 3 },
    ],
  };
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function BenefitOverview({ product, plans, giftPlan, physicalGiftItems, subjects }) {
  const liveCount = plans.reduce((sum, plan) => sum + (plan.lessons?.length || plan.liveCount || 0), 0);
  const videoCount = plans.reduce((sum, plan) => {
    const parsedCount = getCourseVideoRows(plan).length;
    return sum + (parsedCount || plan.videoEntitlement || 0);
  }, 0);
  const teachingAidCount = subjects.reduce((sum, subject) => sum + getTeachingAidItems(subject, product.stage).length, 0);
  const giftValue = giftPlan.items.reduce((sum, item) => sum + getNumericValue(item.value), 0);

  return (
    <section className="benefit-overview-panel">
      <header>
        <div>
          <span>权益总览</span>
          <strong>{subjects.join("、")} · 一页看清全部所得</strong>
        </div>
        <em>详细大纲可逐项展开</em>
      </header>
      <div className="benefit-overview-grid">
        <div>
          <BookOpen size={18} />
          <span>正课权益</span>
          <strong>{liveCount}节直播</strong>
          <small>{videoCount ? `另含 ${videoCount} 条知识视频` : "以学法直播课程为主"}</small>
        </div>
        <div>
          <Gift size={18} />
          <span>赠课权益</span>
          <strong>{giftPlan.items.length}项赠课</strong>
          <small>{giftValue ? `标注价值合计 ¥${giftValue}` : "按产品买赠规则开通"}</small>
        </div>
        <div>
          <PackageCheck size={18} />
          <span>资料权益</span>
          <strong>{teachingAidCount}项教辅</strong>
          <small>{physicalGiftItems.length ? `另含 ${physicalGiftItems.length} 项实物/文创` : "按所购科目自动匹配"}</small>
        </div>
      </div>
      <div className="benefit-overview-subjects">
        {plans.map((plan) => (
          <span key={plan.subject}>{plan.subject}</span>
        ))}
      </div>
    </section>
  );
}

function BenefitDisclosure({ title, description, children, open = false }) {
  return (
    <details className="benefit-disclosure" open={open ? true : undefined}>
      <summary>
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        <ChevronDown size={19} />
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
          <span>随单赠礼与课程教辅分开说明。</span>
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
        {item.image ? <img src={assetUrl(item.image)} alt={item.name} /> : <span>暂无封面</span>}
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
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const parsed = {};
  courseSubjects.forEach((subject) => {
    const sheetName = type === "live" ? subject : findVideoSheetName(workbook.SheetNames, grade, subject);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      parsed[subject] = [];
      return;
    }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    parsed[subject] = type === "live" ? parseLiveRows(rows) : parseVideoRows(rows);
  });
  return parsed;
}

function findVideoSheetName(sheetNames, grade, subject) {
  return sheetNames.find((name) => name === `${grade}-${subject}`) ??
    sheetNames.find((name) => name.includes(grade) && name.includes(subject)) ??
    sheetNames.find((name) => name.endsWith(`-${subject}`)) ??
    sheetNames.find((name) => name === subject);
}

function parseLiveRows(rows) {
  const [header = [], ...body] = rows;
  const index = createHeaderIndex(header);
  let currentGrade = "";
  let currentQuarter = "";
  return body
    .map((row, rowIndex) => {
      currentGrade = getCell(row, index, "年级") || currentGrade;
      currentQuarter = getCell(row, index, "季度") || getCell(row, index, "季节") || currentQuarter;
      const date = formatExcelDate(getCell(row, index, "日期"));
      const time = String(getCell(row, index, "上课时间") || "").trim();
      const title = String(getCell(row, index, "课程大纲") || getCell(row, index, "课程大纲标题") || "").trim();
      return {
        id: `uploaded-live-${rowIndex + 1}`,
        no: rowIndex + 1,
        grade: currentGrade,
        quarter: currentQuarter,
        date,
        time,
        early: formatSchedule(getCell(row, index, "早鸟期-上课日期"), getCell(row, index, "早鸟期-上课时间")),
        phase1: formatSchedule(getCell(row, index, "一期-上课日期"), getCell(row, index, "一期-上课时间")),
        phase2: formatSchedule(getCell(row, index, "二期-上课日期"), getCell(row, index, "二期-上课时间")),
        phase3: formatSchedule(getCell(row, index, "三期-上课日期"), getCell(row, index, "三期-上课时间")),
        title,
        live: title,
      };
    })
    .filter((row) => row.title);
}

function parseVideoRows(rows) {
  const [header = [], ...body] = rows;
  const index = createHeaderIndex(header);
  return body
    .map((row) => ({
      title: String(getCell(row, index, "视频大纲") || "").trim(),
      difficulty: getCell(row, index, "难度星级") || getCell(row, index, "星级难度"),
      layered: getCell(row, index, "是否分层"),
      quarter: getCell(row, index, "所属季度"),
    }))
    .filter((row) => row.title);
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
    rule: hasSubjectCourses ? "买赠对应学科" : "按表格赠送规则",
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

function resolveCoursePlan(product, subject, forcedPhases) {
  const profile = getSubjectProfile(product, subject);
  const isG1Autumn = String(product.grade).includes("高一") && `${product.stage}${product.name}`.includes("秋实");
  if (isG1Autumn && ["语文", "数学", "英语", "物理", "化学"].includes(subject)) {
    profile.knowledgeVideos = Math.max(Number(product.core.knowledgeVideos) || 0, 40);
  }
  const parsedPlan = resolveParsedCoursePlan(product, subject, profile, forcedPhases);
  if (parsedPlan) return parsedPlan;

  const basePlan = courseCatalog[product.grade]?.[subject] ?? null;

  if (basePlan) {
    const shouldClearVideos = profile.knowledgeVideos === 0;
    const coveragePhases = forcedPhases?.length ? forcedPhases : product.coveragePhases?.length ? product.coveragePhases : getDefaultCoveragePhases(product);
    const videoPhases = getVideoCoveragePhases(product, coveragePhases);
    const rawLessons = basePlan.lessons.filter((lesson) => phaseMatches(lesson.quarter, coveragePhases));
    const videoPool = shouldClearVideos
      ? []
      : basePlan.videoLibrary
          .filter((video) => phaseMatches(video.quarter, videoPhases))
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
    time: "以实际排课为准",
    lessons: product.lessons ?? [],
    unmatchedVideos: [],
    summary: profile.summary,
    isPlaceholder: true,
  };
}

function resolveParsedCoursePlan(product, subject, profile, forcedPhases) {
  const liveRows = product.parsedCourseData?.live?.[subject] ?? [];
  const uploadedVideoRows = product.parsedCourseData?.video?.[subject] ?? [];
  const fallbackVideoRows = profile.knowledgeVideos
    ? courseCatalog[product.grade]?.[subject]?.videoLibrary ?? []
    : [];
  const videoRows = uploadedVideoRows.length ? uploadedVideoRows : fallbackVideoRows;
  if (!liveRows.length && !uploadedVideoRows.length) return null;

  const coveragePhases = forcedPhases?.length ? forcedPhases : product.coveragePhases?.length ? product.coveragePhases : getDefaultCoveragePhases(product);
  const filteredLive = liveRows.filter((lesson) => phaseMatches(lesson.quarter, coveragePhases));
  let filteredVideos = videoRows
    .filter((video) => phaseMatches(video.quarter, getVideoCoveragePhases(product, coveragePhases)))
    .slice(0, profile.knowledgeVideos || undefined);
  if (!filteredVideos.length && fallbackVideoRows.length && profile.knowledgeVideos) {
    filteredVideos = fallbackVideoRows
      .filter((video) => phaseMatches(video.quarter, getVideoCoveragePhases(product, coveragePhases)))
      .slice(0, profile.knowledgeVideos);
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
    liveCount: lessons.length || profile.liveLessons,
    videoEntitlement: filteredVideos.length,
    videoLibraryCount: filteredVideos.length,
    matchedVideoCount: matchedCount,
    unmatchedVideoCount: Math.max(0, filteredVideos.length - matchedCount),
    videoRows: filteredVideos,
    time: lessons.find((lesson) => lesson.time)?.time ?? "以实际排课为准",
    lessons,
    unmatchedVideos: [],
    summary: [`学法直播${lessons.length}节`, filteredVideos.length ? `知识视频${filteredVideos.length}条` : "无知识视频"],
    isPlaceholder: false,
  };
}

function phaseMatches(phase, selectedPhases) {
  if (!String(phase || "").trim()) return true;
  if (!selectedPhases?.length) return true;
  if (selectedPhases.includes(phase)) return true;
  if (phase === "暑秋" && (selectedPhases.includes("暑期") || selectedPhases.includes("秋季"))) return true;
  if (phase === "夏季" && selectedPhases.includes("暑期")) return true;
  return false;
}

function getVideoCoveragePhases(product, coveragePhases) {
  const isG1Autumn = String(product.grade).includes("高一") && `${product.stage}${product.name}`.includes("秋实");
  if (isG1Autumn) return ["秋季"];
  return product.videoPhases?.length ? product.videoPhases : coveragePhases;
}

function getDefaultCoveragePhases(product) {
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
    ? Math.max(Number(product.core.knowledgeVideos) || 0, 40)
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
  const courseItems = [...(basePlan?.items ?? []), ...(product.customGiftItems ?? [])].filter((item) => item.type === "赠课");
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
  const selectedKeys = product.giftSelections;
  const selectedItems = selectedKeys ? courseItems.filter((item) => isGiftItemSelected(selectedKeys, item)) : courseItems;
  const items = selectedItems.flatMap((item) => {
    if (isSubjectMatchedGift(item)) {
      return subjects.map((subject) => resolveSubjectGiftItem(item, subject));
    }
    if (item.subjectCourses) return [resolveMergedSubjectGiftItem(item, subjects)];
    return [item];
  });
  const firstPlan = basePlan ?? { title: "赠课权益", note: "赠课权益以实际开通内容为准。" };
  return {
    ...firstPlan,
    note: subjects.length > 1 ? `已按所购科目生成赠课权益：${subjects.join("、")}` : firstPlan.note,
    items: uniqueGiftItems(items),
  };
}

function isSubjectMatchedGift(item) {
  return Boolean(item.subjectCourses) && String(item.rule || "").includes("对应学科");
}

function resolveMergedSubjectGiftItem(item, subjects) {
  const subjectBullets = subjects.flatMap((subject) => {
    const courses = item.subjectCourses?.[subject] ?? [];
    return courses.length ? courses.map((course) => `${subject}｜${course}`) : [];
  });
  return {
    ...item,
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
      bullets: item.bullets?.length ? item.bullets : ["该学科具体明细以实际开通内容为准"],
    };
  }
  return {
    ...item,
    detail: `${subject}｜${courses.length}节`,
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
  return uniqueGiftItems(subjects.flatMap((subject) => getPhysicalGiftItems(product, subject)));
}

function getAllPhysicalGiftItems(product, subject) {
  const basePlan = getBaseGiftPlan(product, subject);
  return [...(basePlan?.items ?? []), ...(product.customPhysicalItems ?? [])].filter((item) => item.type !== "赠课");
}

function getAdminGiftCandidates(product) {
  return uniqueGiftItems([
    ...courseSubjects.flatMap((subject) => getBaseGiftPlan(product, subject)?.items ?? []),
    ...(product.customGiftItems ?? []),
  ]);
}

function getGradeGiftCandidates(products, product) {
  return uniqueGiftItems([
    ...products
      .filter((item) => item.grade === product.grade)
      .flatMap((item) => getAdminGiftCandidates(item)),
    ...(product.customGiftItems ?? []),
  ]);
}

function getAdminPhysicalGiftCandidates(product) {
  return uniqueGiftItems([
    ...getAdminGiftCandidates(product).filter((item) => item.type !== "赠课"),
    ...(product.customPhysicalItems ?? []),
  ]);
}

function uniqueGiftItems(items) {
  const map = new Map();
  items.forEach((item) => {
    map.set(getGiftItemKey(item), item);
  });
  return [...map.values()];
}

function getGiftItemKey(item) {
  return `${item.type}-${item.name}`;
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
          <small>以系统开通为准</small>
        </div>
        <div>
          <span>视频释放</span>
          <strong>{product.videoReleasePlan ? "分批释放" : "按开通为准"}</strong>
          <small>{product.videoReleasePlan ?? "以实际开通节奏为准"}</small>
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

function CourseOutlineSplit({ coursePlan, lessons }) {
  const videoRows = getCourseVideoRows(coursePlan);
  const liveRows = chunkItems(lessons, 2);
  const videoTableRows = chunkItems(videoRows, 3);
  return (
    <div className="course-outline-split">
      <section className="outline-block live">
        <header>
          <div>
            <strong>学法直播大纲</strong>
            <span>{coursePlan.subject} ｜ {lessons.length}节</span>
          </div>
          <em><Clock size={14} />{coursePlan.time || "以实际排课为准"}</em>
        </header>
        <table className="compact-outline-table live-compact-table">
          <thead>
            <tr>
              <th>课次</th>
              <th>日期</th>
              <th>时间</th>
              <th>学法直播主题</th>
              <th>课次</th>
              <th>日期</th>
              <th>时间</th>
              <th>学法直播主题</th>
            </tr>
          </thead>
          <tbody>
            {liveRows.map((row, rowIndex) => (
              <tr key={`live-row-${rowIndex}`}>
                {row.map((lesson, index) => (
                  <Fragment key={lesson.id ?? `${lesson.no}-${lesson.live}`}>
                    <td className="outline-no">{lesson.no ?? rowIndex * 2 + index + 1}</td>
                    <td className="outline-date">{lesson.date || "-"}</td>
                    <td className="outline-date">{lesson.time || coursePlan.time || "-"}</td>
                    <td className="outline-title">{lesson.live}</td>
                  </Fragment>
                ))}
                {row.length < 2 ? <EmptyOutlineCells count={4} /> : null}
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
              <span>{coursePlan.subject} ｜ {videoRows.length}条</span>
            </div>
            <em><PackageCheck size={14} />配套补基</em>
          </header>
          <table className="compact-outline-table video-compact-table">
            <thead>
              <tr>
                <th>课次</th>
                <th>课程大纲</th>
                <th>星级难度</th>
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
                      <td className="outline-no">{rowIndex * 3 + index + 1}</td>
                      <td className="outline-title">{getVideoTitle(video)}</td>
                      <td className="outline-difficulty">
                        <span className="outline-stars">{formatDifficultyStars(getVideoDifficulty(video))}</span>
                      </td>
                    </Fragment>
                  ))}
                  {row.length < 3 ? <EmptyOutlineCells count={(3 - row.length) * 3} /> : null}
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
              )) : <span className="empty-video">{lesson.quarter === "暑期" ? "无知识视频" : "以实际开通为准"}</span>}
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
        <span>{giftPlan?.note ?? "赠课权益以实际开通内容为准。"}</span>
      </div>
    );
  }

  const totalValue = giftPlan.items.reduce((sum, item) => {
    const match = String(item.value).match(/¥\s*(\d+)/);
    return sum + (match ? Number(match[1]) : 0);
  }, 0);
  const courseItems = giftPlan.items.filter((item) => item.type === "赠课");

  return (
    <div className="gift-rule-wrap">
      <div className="gift-rule-head">
        <div>
          <strong>{giftPlan.title}</strong>
          <span>{giftPlan.note}</span>
        </div>
        {totalValue > 0 ? <em>赠课价值约 ¥{totalValue}</em> : null}
      </div>
      <div className="gift-poster-grid">
        {courseItems.map((item, index) => (
          <GiftPosterCard item={item} index={index} key={`${item.name}-${index}`} />
        ))}
      </div>
    </div>
  );
}

function GiftPosterCard({ item, index }) {
  const tones = ["cyan", "orange", "purple", "green", "blue"];
  const tone = tones[index % tones.length];
  const bullets = item.bullets?.length ? item.bullets : [item.detail];
  const showValue = item.value && !String(item.value).includes("待补充");
  const compact = bullets.length <= 2;
  const featured = bullets.length >= 5 || item.name.includes("升学路径") || item.name.includes("家长成长") || item.name.includes("预备营");
  return (
    <article className={`gift-poster-card ${tone} ${compact ? "compact" : ""} ${featured ? "featured" : ""}`}>
      <header>
        <strong>{item.name}</strong>
      </header>
      <div className="gift-card-body">
        <div className="gift-mini-cover">
          <span>{item.name.replace(/[·（）()]/g, "").slice(0, 6)}</span>
        </div>
        <div className="gift-card-info">
          <div className="gift-meta">
            <span>{item.detail}</span>
            {showValue ? <em>价值 {item.value}</em> : null}
          </div>
          <p>{item.rule}</p>
        </div>
      </div>
      <ol>
        {bullets.slice(0, 8).map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ol>
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

function buildShareUrl(product, subjects, viewMode = "summary") {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("share", "1");
  url.searchParams.set("product", product.id);
  url.searchParams.set("subjects", Array.isArray(subjects) ? subjects.join(",") : subjects);
  url.searchParams.set("view", viewMode);
  return url.toString();
}

function buildSalesPortalUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("sales", "1");
  return url.toString();
}

createRoot(document.getElementById("root")).render(<App />);
