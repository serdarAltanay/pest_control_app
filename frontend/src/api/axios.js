import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true, 
});

// Access token ekle
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

// Refresh mekanizması
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Cookie'deki refresh token ile yeni access token iste
      const res = await axios.post("/api/auth/refresh", {}, { withCredentials: true });
      const newAccessToken = res.data.accessToken;
      if (!newAccessToken) {
        throw new Error("Refresh döndü ama accessToken yok");
      }

      // 1) localStorage
      localStorage.setItem("accessToken", newAccessToken);

      // 2) axios instance defaults (bundan SONRAKİ tüm istekler)
      api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;

      // 3) orijinal isteğin header’ı (bu anlık retry için)
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      // 4) retry
      return api(originalRequest);

      } catch (err) {
        console.error("Refresh başarısız:", err);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("role");
        localStorage.removeItem("name");
        localStorage.removeItem("email");
        window.location.href = "/"; // login sayfasına dön
      }
    }

    return Promise.reject(error);
  }
);

export default api;
