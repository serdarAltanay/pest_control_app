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
    (typeof window !== "undefined" && window.__API_ORIGIN__) ||
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
  const fixedNoLead = normalizeSlashes(path).replace(/^\/+/, "");
  const hadLeading = String(path).startsWith("/");
  dbg("toAbsoluteUrl IN:", path, "fixedNoLead:", fixedNoLead, "forceApi:", forceApi);

  // Zaten absolute
  if (/^https?:\/\//i.test(path) || /^data:/i.test(path)) {
    dbg("already absolute:", path);
    return path;
  }

  // backend’lik içerikler
  const backendish = forceApi || fixedNoLead.startsWith("uploads/") || fixedNoLead.startsWith("api/");

  if (backendish) {
    const origin = getApiOrigin();
    const out = `${origin}/${fixedNoLead}`;
    dbg("→ backend URL:", out);
    return out;
  }

  // Frontend public (ör: /noavatar.jpg)
  const out = `/${hadLeading ? fixedNoLead : fixedNoLead}`;
  dbg("→ frontend asset:", out);
  return out;
}

export function addCacheBust(url) {
  if (!url) return "";
  const out = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
  dbg("addCacheBust:", out);
  return out;
}

/**
 * Avatar URL’i üretir:
 * - uploads/... → backend origin ile absolute
 * - /noavatar.jpg gibi kök public asset → olduğu gibi
 * - http(s)/data URL → dokunma
 */
export function getAvatarUrl(profileImage, { bust = false } = {}) {
  let raw;

  if (!profileImage) {
    raw = "/noavatar.jpg";
  } else {
    const s = String(profileImage);
    if (/^https?:\/\//i.test(s) || /^data:/i.test(s)) {
      raw = s; // Tam URL
    } else if (s.startsWith("/uploads/") || s.startsWith("uploads/")) {
      raw = toAbsoluteUrl(s, { forceApi: true }); // backend
    } else if (s.startsWith("/")) {
      raw = s; // frontend public (örn. /something.jpg)
    } else {
      // uz relative ise backend’e bağla
      raw = toAbsoluteUrl(s, { forceApi: true });
    }
  }

  const out = bust ? addCacheBust(raw) : raw;
  dbg("getAvatarUrl:", { profileImage, raw, out, bust });
  return out;
}
