// src/pages/login/Login.jsx
import { useState, useEffect, useRef, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import api from "../../api/axios.js";
import { toast } from "react-toastify";
import { parseJwt } from "../../utils/auth.js";
import { ProfileContext } from "../../context/ProfileContext.jsx";
import "./Login.scss";

/**
 * Yeni model notları:
 * - AccessOwner login olur; backend JWT.role = "customer" döner (FE route mantığı sade).
 * - "Customer" artık yalnızca kapsam temsil eder; giriş yapan bir varlık değildir.
 * - Girişten sonra:
 *    admin/employee  -> /work
 *    accessOwner(*)  -> /customer     (*JWT.role = "customer")
 */
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const triedRefreshRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchProfile } = useContext(ProfileContext);

  // Private route'tan geldiysek geri dönecek rota
  const from = (location.state && location.state.from) || null;

  // Mount'ta (1 kez) sessiz refresh dene (cookie varsa)
  useEffect(() => {
    if (triedRefreshRef.current) return;
    triedRefreshRef.current = true;

    (async () => {
      try {
        const { data } = await axios.post("/api/auth/refresh", {}, { withCredentials: true });
        if (data?.accessToken) {
          localStorage.setItem("accessToken", data.accessToken);

          // role FE yönlendirme için hala gerekli
          const payload = parseJwt(data.accessToken);
          if (payload?.role) localStorage.setItem("role", payload.role);

          await fetchProfile?.();

          // geri dönüş rotası öncelikli
          if (from) {
            navigate(from, { replace: true });
          } else {
            // accessOwner -> "customer" rolüyle gelir
            navigate(payload?.role === "customer" ? "/customer" : "/work", { replace: true });
          }
        }
      } catch {
        // cookie yok/expired: login ekranında kal
      }
    })();
  }, [fetchProfile, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const res = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      const { accessToken, role, fullName, email: serverEmail } = res.data || {};

      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("role", role); // "admin" | "employee" | "customer"(=AccessOwner)
      localStorage.setItem("fullName", fullName || "");
      localStorage.setItem("name", fullName || "");
      localStorage.setItem("email", serverEmail || email.trim().toLowerCase());

      await fetchProfile?.();
      toast.success("Giriş başarılı 🎉");

      if (from) {
        navigate(from, { replace: true });
      } else {
        navigate(role === "customer" ? "/customer" : "/work", { replace: true });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Giriş hatası ❌";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      <h2>Giriş Yap</h2>

      <label>
        <span>E-posta</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="mail@ornek.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          disabled={loading}
        />
      </label>

      <label>
        <span>Şifre</span>
        <div className="password-field">
          <input
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          <button
            type="button"
            className="toggle-pw"
            onClick={() => setShowPw((s) => !s)}
            aria-label={showPw ? "Şifreyi gizle" : "Şifreyi göster"}
            disabled={loading}
          >
            {showPw ? "Gizle" : "Göster"}
          </button>
        </div>
      </label>

      <button type="submit" disabled={loading}>
        {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>
    </form>
  );
}
