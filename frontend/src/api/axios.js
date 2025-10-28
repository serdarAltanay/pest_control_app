// src/api/axios.js
import axios from "axios";

const API_ORIGIN =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_ORIGIN) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_API_ORIGIN) ||
  (typeof window !== "undefined" && window.__API_ORIGIN__) ||
  "http://localhost:5000";
const API_BASE = `${String(API_ORIGIN).replace(/\/+$/, "")}/api`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // refresh cookie için şart
});

// ---- Access token'ı isteğe ekle
api.interceptors.request.use((config) => {
  const t = localStorage.getItem("accessToken");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// ---- 401 refresh kuyruğu
let isRefreshing = false;
let waiters = [];

function enqueueWaiter() {
  return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
}
function flushWaiters(err) {
  if (err) waiters.forEach(w => w.reject(err));
  else     waiters.forEach(w => w.resolve());
  waiters = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;

    const isSilent =
      original._isHeartbeat === true ||
      original.headers?.["x-silent"] === "1" ||
      /\/presence\/heartbeat$/.test(original.url || "");

    // --- 403: sessiz isteklerde aynen ilet; (refresh de işe yaramaz)
    if (status === 403) return Promise.reject(error);

    // --- 401: her durumda refresh dene (sessizde de!)
    if (status === 401 && !original._retry) {
      original._retry = true;

      try {
        if (isRefreshing) {
          await enqueueWaiter();
        } else {
          isRefreshing = true;
          const r = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
          const token = r.data?.accessToken;
          if (!token) throw new Error("No accessToken from refresh");
          localStorage.setItem("accessToken", token);
          api.defaults.headers.common.Authorization = `Bearer ${token}`;
          isRefreshing = false;
          flushWaiters();
        }

        // yenilenmiş token ile orijinal isteği tekrar dene
        original.headers = original.headers || {};
        const t = localStorage.getItem("accessToken");
        if (t) original.headers.Authorization = `Bearer ${t}`;
        return api(original);
      } catch (e) {
        isRefreshing = false;
        flushWaiters(e);

        // Sessiz çağrılarda view değişimi yapma; normal çağrılarda login'e yönlendir
        if (!isSilent) {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("role");
          localStorage.removeItem("name");
          localStorage.removeItem("email");
          try { window.location.assign("/login"); } catch {}
        }
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
