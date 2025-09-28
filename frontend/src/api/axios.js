// src/api/axios.js
import axios from "axios";

// Axios instance oluştur
const api = axios.create({
  baseURL: "/api", // backend adresin
  headers: {
    "Content-Type": "application/json",
  },
});

// İstekten önce access token ekle
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Cevap interceptor (401 olursa refresh dene)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Access token süresi bitmiş -> refresh dene
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem("refreshToken");

        // Refresh token ile yeni access token al
        const res = await axios.post("/api/auth/refresh", {
          refreshToken,
        });

        const newAccessToken = res.data.accessToken;
        localStorage.setItem("accessToken", newAccessToken);

        // Yeni token ile eski isteği tekrar et
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (err) {
        console.error("Refresh başarısız:", err);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/"; // login sayfasına yönlendir
      }
    }

    return Promise.reject(error);
  }
);

export default api;
