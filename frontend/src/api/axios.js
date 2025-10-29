import axios from "axios";

/** ───────────────────── Base URL ───────────────────── */
const API_ORIGIN =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_ORIGIN) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_API_ORIGIN) ||
  (typeof window !== "undefined" && window.__API_ORIGIN__) ||
  "http://localhost:5000";

const API_BASE = `${String(API_ORIGIN).replace(/\/+$/, "")}/api`;

/** ───────────────────── Helpers ───────────────────── */
const isAuthPath = (u = "") =>
  /\/auth\/(login|refresh|logout)(?:[/?#]|$)/.test(String(u));

/** ───────────────────── Instances ───────────────────── */
// Normal istekler (interceptor’lü)
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // refresh cookie için şart
});

// Interceptor’suz “çıplak” instance (sadece REFRESH ve özel durumlar için)
const apiBare = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

/** Dışarı açılan: Bearer eklemeyen & refresh denemeyen tek-seferlik yardımcı */
export function apiNoRefresh(cfg = {}) {
  const headers = { ...(cfg.headers || {}), Authorization: "" };
  return apiBare({ ...cfg, headers });
}

/** ───────────────────── Request ───────────────────── */
api.interceptors.request.use((config) => {
  const url = String(config.url || "");
  const t = localStorage.getItem("accessToken");

  // login/refresh/logout'a Bearer ekleme (401 zincirini tetiklemeyelim)
  if (!isAuthPath(url) && t) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${t}`;
    }
  }
  return config;
});

/** ───────────────────── Response (401 refresh) ───────────────────── */
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

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const url = String(original.url || "");

    // Heartbeat gibi isteklerde refresh denemesi yapma
    const suppressRefresh =
      original._isHeartbeat === true || /\/presence\/heartbeat$/.test(url);

    // 403: yetki yok → guard karar versin
    if (status === 403) return Promise.reject(error);

    // 401 → access süresi dolmuş olabilir
    if (status === 401) {
      // auth rotası / zaten bir kez denenmiş / suppress ise bırak
      if (suppressRefresh || original._retry || isAuthPath(url)) {
        return Promise.reject(error);
      }

      original._retry = true;

      try {
        if (isRefreshing) {
          // Devam eden refresh’i bekle
          const newToken = await enqueueWaiter();
          if (newToken) {
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${newToken}`;
          }
          return api(original);
        }

        isRefreshing = true;

        // REFRESH'i interceptor’suz ve BEARER’sız yap
        const r = await apiBare.post("/auth/refresh", {}, { headers: { Authorization: "" } });
        const token = r.data?.accessToken;
        if (!token) throw new Error("No accessToken from refresh");

        localStorage.setItem("accessToken", token);
        api.defaults.headers.common.Authorization = `Bearer ${token}`;

        isRefreshing = false;
        flushWaiters(null, token);

        // Orijinal isteği yeni token ile tekrar et
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (e) {
        isRefreshing = false;
        flushWaiters(e, null);

        // Sert redirect yok, sadece temizlik
        try {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("role");
          localStorage.removeItem("fullName");
          localStorage.removeItem("name");
          localStorage.removeItem("email");
          localStorage.removeItem("profileImage");
          localStorage.removeItem("accessOwnerRole");
        } catch {}

        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
