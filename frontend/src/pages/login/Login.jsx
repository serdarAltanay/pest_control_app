import { useState } from "react";
import api from "../../api/axios.js";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify"; // toast import
import "./Login.scss";
import { useEffect } from "react";
import { parseJwt } from "../../utils/auth.js";
import axios from "axios";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
  (async () => {
    try {
      // DÜZ axios: interceptor tetiklenmez
      const { data } = await axios.post("/api/auth/refresh", {}, { withCredentials: true });
      if (data?.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
        const payload = parseJwt(data.accessToken);
        if (payload?.role) localStorage.setItem("role", payload.role);
        navigate(payload?.role === "customer" ? "/customer" : "/work", { replace: true });
      }
    } catch {}
  })();
}, [navigate]);


  const handleSubmit = async (e) => {
  e.preventDefault();
  try {
    const res = await api.post("/auth/login", { email, password });

    localStorage.setItem("accessToken", res.data.accessToken);
    localStorage.setItem("role", res.data.role);
    localStorage.setItem("name", res.data.name);
    localStorage.setItem("email", res.data.email);

    toast.success("Giriş başarılı 🎉");

    if (res.data.role === "customer") navigate("/customer");
    else navigate("/work");
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
