// src/utils/getAssetUrl.js

// Bazı bundler'lar import.meta'ya doğrudan/opsiyonel zincir ile erişimde uyarı veriyor.
// Bu yüzden önce güvenli bir şekilde env'i ayıklıyoruz (Vite varsa okur, yoksa undefined kalır).

/* eslint-disable no-undef */
const viteEnv =
  (typeof import.meta !== "undefined" && import.meta && import.meta.env)
    ? import.meta.env
    : undefined;
/* eslint-enable no-undef */

// .env’de (Vite) VITE_API_ORIGIN veya (CRA/Webpack) REACT_APP_API_ORIGIN varsa kullan,
// yoksa window.location.origin’e düş.
const RAW_API_ORIGIN =
  (viteEnv && viteEnv.VITE_API_ORIGIN) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_ORIGIN) ||
  "";

const API_ORIGIN = (RAW_API_ORIGIN.replace(/\/+$/, "")) || window.location.origin;

// /uploads gibi relative bir yol mu? (http/https ile başlamıyorsa relative’tir)
export function toAbsoluteUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path; // zaten absolute
  // baştaki / işaretlerini tekilleştir
  const cleaned = String(path).replace(/^\/+/, "");
  return `${API_ORIGIN}/${cleaned}`;
}

// Cache-bust: aynı dosya adı overwrite olunca tarayıcı eskiyi göstermesin
export function addCacheBust(url) {
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${Date.now()}`;
}

// Avatar özel helper: null/boşsa fallback göster
export function getAvatarUrl(profileImage, { bust = false } = {}) {
  const raw = profileImage ? toAbsoluteUrl(profileImage) : "/noavatar.jpg";
  return bust ? addCacheBust(raw) : raw;
}
