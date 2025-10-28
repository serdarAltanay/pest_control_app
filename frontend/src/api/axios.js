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
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const t = localStorage.getItem("accessToken");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config || {};
    const status = error.response?.status;

    // ——— SESSİZ İSTEK TESPİTİ ———
    const isSilent =
      originalRequest._isHeartbeat === true ||
      originalRequest.headers?.["x-silent"] === "1" ||
      /\/presence\/heartbeat$/.test(originalRequest.url || "");

    // Sessiz istekler 401/403’te hiç bir şey yapmadan hatayı fırlatsın
    if (isSilent && (status === 401 || status === 403)) {
      return Promise.reject(error);
    }

    // Normal refresh akışı
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const r = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        const token = r.data?.accessToken;
        if (!token) throw new Error("No accessToken from refresh");
        localStorage.setItem("accessToken", token);
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (e) {
        // Sessiz değilse redirect; sessizse sadece hata
        if (!isSilent) {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("role");
          localStorage.removeItem("name");
          localStorage.removeItem("email");
          window.location.assign("/login");
        }
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
