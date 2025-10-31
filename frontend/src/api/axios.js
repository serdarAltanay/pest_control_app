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
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

const apiBare = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

/** ───────────────────── Auth Utils ───────────────────── */
export function clearAuth() {
  try {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("role");
    localStorage.removeItem("fullName");
    localStorage.removeItem("name");
    localStorage.removeItem("email");
    localStorage.removeItem("profileImage");
    localStorage.removeItem("accessOwnerRole");
  } catch {}
  try { delete api.defaults.headers.common.Authorization; } catch {}
}

export function setAuthToken(token) {
  if (!token) { clearAuth(); return; }
  localStorage.setItem("accessToken", token);
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

/** ───────────────────── Request ───────────────────── */
api.interceptors.request.use((config) => {
  const url = String(config.url || "");
  const t = localStorage.getItem("accessToken");

  if (isAuthPath(url)) {
    config.headers = config.headers || {};
    config.headers.Authorization = "";
    return config;
  }

  if (t) {
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
    const suppressRefresh =
      original._isHeartbeat === true || /\/presence\/heartbeat$/.test(url);

    if (status === 403) return Promise.reject(error);

    if (status === 401) {
      if (suppressRefresh || original._retry || isAuthPath(url)) {
        return Promise.reject(error);
      }
      original._retry = true;

      try {
        if (isRefreshing) {
          const newToken = await enqueueWaiter();
          if (newToken) {
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${newToken}`;
          }
          return api(original);
        }

        isRefreshing = true;

        const r = await apiBare.post("/auth/refresh", {}, { headers: { Authorization: "" } });
        const token = r.data?.accessToken;
        if (!token) throw new Error("No accessToken from refresh");

        setAuthToken(token);
        isRefreshing = false;
        flushWaiters(null, token);

        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (e) {
        isRefreshing = false;
        flushWaiters(e, null);

        try { await apiBare.post("/auth/logout", {}, { headers: { Authorization: "" } }); } catch {}
        clearAuth();
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

export { apiBare };
export function apiNoRefresh(cfg = {}) {
  const headers = { ...(cfg.headers || {}), Authorization: "" };
  return apiBare({ ...cfg, headers });
}

export default api;
