// src/api/axios.js
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
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
      return Promise.reject(error); // çağıran tarafta zaten try/catch ile yutuyoruz
    }

    // --- Normal refresh akışı ---
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const res = await axios.post("/api/auth/refresh", {}, { withCredentials: true });
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

export default api;
