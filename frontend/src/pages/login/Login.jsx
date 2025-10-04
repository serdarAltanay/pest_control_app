// src/pages/login/Login.jsx
import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import api from "../../api/axios.js";
import { parseJwt } from "../../utils/auth.js";
import { ProfileContext } from "../../context/ProfileContext.jsx";
import "./Login.scss";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { fetchProfile } = useContext(ProfileContext);

  // Sayfa açılınca cookie'deki refresh token ile sessiz giriş dene
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.post("/api/auth/refresh", {}, { withCredentials: true });
        if (data?.accessToken) {
          localStorage.setItem("accessToken", data.accessToken);
          const payload = parseJwt(data.accessToken);
          if (payload?.role) localStorage.setItem("role", payload.role);
          await fetchProfile?.();
          navigate(payload?.role === "customer" ? "/customer" : "/work", { replace: true });
        }
      } catch {
        // sessizce geç
      }
    })();
  }, [navigate, fetchProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/auth/login", { email, password });

      localStorage.setItem("accessToken", res.data.accessToken);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("fullName", res.data.fullName);
      localStorage.setItem("name", res.data.fullName); // geri uyumluluk
      localStorage.setItem("email", res.data.email);

      await fetchProfile?.();

      toast.success("Giriş başarılı 🎉");
      navigate(res.data.role === "customer" ? "/customer" : "/work");
    } catch (err) {
      toast.error(err.response?.data?.message || "Giriş hatası ❌");
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <h2>Giriş Yap</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Şifre"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Giriş Yap</button>
    </form>
  );
}
