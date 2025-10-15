// src/api/axios.js
import axios from "axios";

// --- Backend origin'i ENV'den al (Vite/CRA) ve /api ekle ---
const API_ORIGIN =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_ORIGIN) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_ORIGIN) ||
  (typeof window !== "undefined" && window.__API_ORIGIN__) || // opsiyonel: index.html'de set edebilirsin
  "http://localhost:5000";

const API_BASE = `${String(API_ORIGIN).replace(/\/+$/, "")}/api`;

const api = axios.create({
  baseURL: API_BASE,          // ⬅️ eskiden "/api" idi
  withCredentials: true,
});

// Access token ekle
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Refresh mekanizması
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const status = error.response?.status;

    // --- HEARTBEAT’i refresh/redirect akışından muaf tut ---
    const isHeartbeat =
      originalRequest._isHeartbeat === true ||
      originalRequest.headers?.["x-silent"] === "1" ||
      /\/presence\/heartbeat$/.test(originalRequest.url || "");

    // Heartbeat 401/403 verirse: refresh deneme, redirect yapma (sessizce geç)
    if (isHeartbeat && (status === 401 || status === 403)) {
      return Promise.reject(error);
    }

    // --- Normal refresh akışı ---
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // ⬇️ Global axios ile de aynı BASE'i kullan
        const res = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        const newAccessToken = res.data.accessToken;
        if (!newAccessToken) throw new Error("Refresh döndü ama accessToken yok");

        localStorage.setItem("accessToken", newAccessToken);
        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return api(originalRequest); // retry
      } catch (err) {
        console.error("Refresh başarısız:", err);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("role");
        localStorage.removeItem("name");
        localStorage.removeItem("email");
        window.location.href = "/"; // login
      }
    }

    return Promise.reject(error);
  }
);

if (typeof console !== "undefined") {
  console.log("[api] baseURL =", api.defaults.baseURL);
}

export default api;
