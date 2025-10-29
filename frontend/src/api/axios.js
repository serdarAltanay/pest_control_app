// src/api/axios.js
import axios from "axios";

/** ───────────────────── Base URL ───────────────────── */
const API_ORIGIN =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_ORIGIN) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_API_ORIGIN) ||
  (typeof window !== "undefined" && window.__API_ORIGIN__) ||
  "http://localhost:5000";

const API_BASE = `${String(API_ORIGIN).replace(/\/+$/, "")}/api`;

/** ───────────────────── Instance ───────────────────── */
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // refresh cookie için şart
});

/** ───────────────────── Request ───────────────────── */
api.interceptors.request.use((config) => {
  const t = localStorage.getItem("accessToken");
  if (t) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

/** ───────────────────── Refresh Kuyruğu ───────────────────── */
let isRefreshing = false;
let waiters = [];

function enqueueWaiter() {
  return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
}
function flushWaiters(err, token) {
  if (err) waiters.forEach((w) => w.reject(err));
  else waiters.forEach((w) => w.resolve(token));
  waiters = [];
}

const isAuthPath = (u = "") =>
  /\/auth\/(login|refresh|logout)(\?|$)/.test(u);

/** ───────────────────── Response ───────────────────── */
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const url = String(original.url || "");

    // heartbeat isteklerinde refresh denemesi yapma (sessiz kalsın)
    const suppressRefresh =
      original._isHeartbeat === true || /\/presence\/heartbeat$/.test(url);

    // x-silent: refresh başarısızsa redirect yapma
    const noRedirect =
      original._isHeartbeat === true || original.headers?.["x-silent"] === "1";

    // 403: yetki yok → refresh işe yaramaz, direkt düş
    if (status === 403) {
      return Promise.reject(error);
    }

    // 401: access süresi dolmuş olabilir
    if (status === 401) {
      // auth rotaları / login / refresh tekrar denenmesin
      if (suppressRefresh || original._retry || isAuthPath(url)) {
        return Promise.reject(error);
      }

      original._retry = true;

      try {
        if (isRefreshing) {
          // Diğer refresh bitene kadar bekle; yeni token'ı al
          const newToken = await enqueueWaiter();
          const t = newToken || localStorage.getItem("accessToken");
          original.headers = original.headers || {};
          if (t) original.headers.Authorization = `Bearer ${t}`;
          return api(original);
        }

        // İlk biz girdik: refresh yap
        isRefreshing = true;
        const r = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        const token = r.data?.accessToken;
        if (!token) throw new Error("No accessToken from refresh");

        localStorage.setItem("accessToken", token);
        api.defaults.headers.common.Authorization = `Bearer ${token}`;

        isRefreshing = false;
        flushWaiters(null, token);

        // orijinal isteği yeni token ile tekrar dene
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (e) {
        isRefreshing = false;
        flushWaiters(e, null);

        // Oturumu temizle ve (sessiz değilse) login'e yönlendir
        try {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("role");
          localStorage.removeItem("name");
          localStorage.removeItem("email");
          localStorage.removeItem("profileImage");
        } catch {}
        if (!noRedirect) {
          try { window.location.assign("/login"); } catch {}
        }
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

/** ───────────────────── Yardımcılar ───────────────────── */
// Sessiz istek göndermek istersen:
//   apiSilent.get("/ek1?scope=mine")
export function apiSilent(cfg = {}) {
  return api({
    ...cfg,
    headers: { ...(cfg.headers || {}), "x-silent": "1" },
  });
}

// Heartbeat gibi “refresh deneme” istemediğin çağrılar için:
//   apiHeartbeat({ method: "post", url: "/presence/heartbeat", data: {...} })
export function apiHeartbeat(cfg = {}) {
  return api({ ...cfg, _isHeartbeat: true });
}

export default api;
