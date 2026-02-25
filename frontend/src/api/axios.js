import axios from "axios";

/** ───────────────────── Base URL ───────────────────── */
const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const API_ORIGIN = isLocal
  ? "http://localhost:5000"
  : "https://pest-control-app.onrender.com";

const API_BASE = `${String(API_ORIGIN).replace(/\/+$/, "")}/api`;

/** ───────────────────── Helpers ───────────────────── */
const isAuthPath = (u = "") =>
  /\/auth\/(login|refresh|logout)(?:[/?#]|$)/.test(String(u));

/** ───────────────────── Global Loading State ───────────────────── */
export const apiLoadingState = {
  activeRequests: 0,
  listeners: [],
  timer: null,
  subscribe(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  },
  notify() {
    clearTimeout(this.timer);
    if (this.activeRequests > 0) {
      // Sadece 200ms'den uzun süren isteklerde loader görünsün (pır pır yapmaması için)
      this.timer = setTimeout(() => {
        if (this.activeRequests > 0) {
          this.listeners.forEach(fn => fn(true));
        }
      }, 200);
    } else {
      // İstek biter bitmez gizle
      this.listeners.forEach(fn => fn(false));
    }
  }
};

const isSilent = (config) => {
  const url = String(config?.url || "");
  if (config?._silent || config?._isHeartbeat) return true;
  if (/\/(presence\/heartbeat|auth\/refresh)/.test(url)) return true;
  return false;
};

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
  } catch { }
  try { delete api.defaults.headers.common.Authorization; } catch { }
}

export function setAuthToken(token) {
  if (!token) { clearAuth(); return; }
  localStorage.setItem("accessToken", token);
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

/** ───────────────────── Request ───────────────────── */
api.interceptors.request.use((config) => {
  if (!isSilent(config)) {
    apiLoadingState.activeRequests++;
    apiLoadingState.notify();
  }

  const url = String(config.url || "");
  const t = localStorage.getItem("accessToken");

  if (isAuthPath(url)) {
    config.headers = config.headers || {};
    config.headers.Authorization = ""; // Bearer'i özellikle SIFIRLA
    return config;
  }

  if (t) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${t}`;
    }
  }
  return config;
}, (error) => {
  apiLoadingState.activeRequests = Math.max(0, apiLoadingState.activeRequests - 1);
  apiLoadingState.notify();
  return Promise.reject(error);
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
  (res) => {
    if (!isSilent(res.config)) {
      apiLoadingState.activeRequests = Math.max(0, apiLoadingState.activeRequests - 1);
      apiLoadingState.notify();
    }
    return res;
  },
  async (error) => {
    if (!isSilent(error.config)) {
      apiLoadingState.activeRequests = Math.max(0, apiLoadingState.activeRequests - 1);
      apiLoadingState.notify();
    }

    const original = error.config || {};
    const status = error.response?.status;
    const url = String(original.url || "");

    // Heartbeat gibi isteklerde refresh denemesi yapma
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

        try { await apiBare.post("/auth/logout", {}, { headers: { Authorization: "" } }); } catch { }
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
