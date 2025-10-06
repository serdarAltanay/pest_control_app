// .env’de VITE_API_ORIGIN tanımlı değilse, window.location.origin’e düşer
const API_ORIGIN =
  import.meta?.env?.VITE_API_ORIGIN?.replace(/\/+$/, "") ||
  window.location.origin;

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
