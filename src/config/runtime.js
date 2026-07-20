export const PRODUCTS_STORAGE_KEY = "youdao-benefits-products-v5-g1-autumn-course-refresh";
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || "https://stangersasengbong366-byte.github.io/lingshi-/";
export const CLOUD_CONFIG_TABLE = "benefit_configs";
export const CLOUD_PRODUCTS_LEGACY_ID = "products";
export const CLOUD_PRODUCTS_DRAFT_ID = "products_draft";
export const CLOUD_PRODUCTS_PUBLISHED_ID = "products_published";
export const cloudConfigEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function assetUrl(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}
