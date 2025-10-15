/* eslint-disable no-undef */
const viteEnv =
  (typeof import.meta !== "undefined" && import.meta && import.meta.env)
    ? import.meta.env
    : undefined;
/* eslint-enable no-undef */

const DEBUG = true;
const dbg = (...a) => { if (DEBUG && typeof console !== "undefined") console.log("[asset-url]", ...a); };

function normalizeSlashes(p) {
  return String(p || "").replace(/\\/g, "/");
}

// ENV’den backend origin
function getEnvApiOrigin() {
  const raw =
    (viteEnv && viteEnv.VITE_API_ORIGIN) ||
    (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_ORIGIN) ||
    (typeof window !== "undefined" && window.__API_ORIGIN__) || // opsiyonel: window değişkeni
    "";
  const cleaned = String(raw).replace(/\/+$/, "");
  dbg("ENV origin:", cleaned || "(empty)");
  return cleaned;
}

let axiosOriginCache = null;

// ⚠️ ENV’i her zaman 1. sırada dene, cache’i override et
export function getApiOrigin() {
  const envOrigin = getEnvApiOrigin();
  if (envOrigin) {
    if (axiosOriginCache && axiosOriginCache !== envOrigin) {
      dbg("override cached origin with ENV:", axiosOriginCache, "→", envOrigin);
    } else {
      dbg("use ENV origin:", envOrigin);
    }
    axiosOriginCache = envOrigin;
    return axiosOriginCache;
  }

  // ENV yoksa axios baseURL dene
  if (!axiosOriginCache) {
    try {
      const api = require("../api/axios").default;
      const base = api?.defaults?.baseURL; // "http://:5000/api" veya "/api"
      dbg("axios baseURL:", base);

      if (base) {
        const url = new URL(base, window.location.origin);
        if (/^https?:$/.test(url.protocol)) {
          axiosOriginCache = url.origin;
          dbg("use axios origin:", axiosOriginCache);
          return axiosOriginCache;
        }
      }
    } catch (e) {
      dbg("axios require failed:", e?.message);
    }
    // Son çare: location.origin
    axiosOriginCache = window.location.origin;
    dbg("fallback to window.origin:", axiosOriginCache);
  } else {
    dbg("getApiOrigin (cached):", axiosOriginCache);
  }
  return axiosOriginCache;
}

// uploads/api yollarını absolute yap
export function toAbsoluteUrl(path, { forceApi = false } = {}) {
  if (!path) return "";
  const fixed = normalizeSlashes(path).replace(/^\/+/, "");
  dbg("toAbsoluteUrl IN:", path, "fixed:", fixed, "forceApi:", forceApi);

  if (/^https?:\/\//i.test(fixed)) {
    dbg("already absolute:", fixed);
    return fixed;
  }

  const backendish = forceApi || fixed.startsWith("uploads/") || fixed.startsWith("api/");
  if (backendish) {
    const origin = getApiOrigin();
    const out = `${origin}/${fixed}`;
    dbg("→ backend URL:", out);
    return out;
  }

  const out = `/${fixed}`;
  dbg("→ frontend asset:", out);
  return out;
}

export function addCacheBust(url) {
  if (!url) return "";
  const out = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
  dbg("addCacheBust:", out);
  return out;
}

export function getAvatarUrl(profileImage, { bust = false } = {}) {
  const raw = profileImage
    ? toAbsoluteUrl(profileImage, { forceApi: true })
    : "/noavatar.jpg";
  const out = bust ? addCacheBust(raw) : raw;
  dbg("getAvatarUrl:", { profileImage, raw, out, bust });
  return out;
}
