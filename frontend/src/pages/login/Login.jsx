import { useState, useEffect, useRef, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api, { apiNoRefresh, clearAuth, setAuthToken } from "../../api/axios.js";
import { toast } from "react-toastify";
import { parseJwt, isExpired } from "../../utils/auth.js";
import { ProfileContext } from "../../context/ProfileContext.jsx";
import "./Login.scss";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const triedOnce = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchProfile } = useContext(ProfileContext) || {};

  const from = (location.state && location.state.from) || null;
  const LOGIN_PATH = "/";

  const safeNavigate = (target) => {
    if (!target) return;
    if (location.pathname !== target) navigate(target, { replace: true });
  };

  const isAllowedForRole = (path, role) => {
    if (!path) return false;
    const r = String(role || "").toLowerCase();
    if (r === "customer") {
      return path.startsWith("/customer") || /^\/ek1\/visit\/[^/]+/i.test(path);
    }
    if (r === "admin" || r === "employee") {
      return !path.startsWith("/customer");
    }
    return false;
  };

  const pickTarget = (role) => {
    const roleTarget = role === "customer" ? "/customer" : "/work";
    if (from && from !== LOGIN_PATH && isAllowedForRole(from, role)) return from;
    return roleTarget;
  };

  useEffect(() => {
    if (triedOnce.current) return;
    triedOnce.current = true;

    const qs = new URLSearchParams(location.search);
    const skipRefresh = qs.get("fresh") === "1";

    if (skipRefresh) {
      clearAuth();
    } else {
      const t = localStorage.getItem("accessToken");
      const r = localStorage.getItem("role");
      if (t && !isExpired(t) && r) {
        safeNavigate(pickTarget(r));
        return;
      }
    }

    if (!skipRefresh) {
      (async () => {
        try {
          const { data } = await apiNoRefresh({ method: "POST", url: "/auth/refresh" });
          if (data?.accessToken) {
            setAuthToken(data.accessToken);
            const payload = parseJwt(data.accessToken);
            if (payload?.role) localStorage.setItem("role", payload.role);
            try { await fetchProfile?.(); } catch { }
            safeNavigate(pickTarget(payload?.role));
          }
        } catch {
          // cookie yok/expired → login’de kal
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    // Input validation
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast.warn("Lütfen e-posta adresinizi girin.");
      return;
    }
    if (!password) {
      toast.warn("Lütfen şifrenizi girin.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.warn("Geçerli bir e-posta adresi girin.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/login", {
        email: trimmedEmail,
        password,
      });

      const { accessToken, role, fullName, email: serverEmail } = res.data || {};
      setAuthToken(accessToken);
      localStorage.setItem("role", role);
      localStorage.setItem("fullName", fullName || "");
      localStorage.setItem("name", fullName || "");
      localStorage.setItem("email", serverEmail || trimmedEmail);

      try { await fetchProfile?.(); } catch { }

      const displayName = fullName || trimmedEmail;
      toast.success(`Hoş geldiniz, ${displayName}`);
      safeNavigate(pickTarget(role));
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error;

      if (status === 401) {
        toast.error(serverMsg || "E-posta veya şifre hatalı.");
      } else if (status === 403) {
        toast.error("Bu hesap devre dışı bırakılmış.");
      } else if (status >= 500) {
        toast.error("Sunucuya ulaşılamıyor. Lütfen daha sonra tekrar deneyin.");
      } else if (!err?.response) {
        toast.error("İnternet bağlantınızı kontrol edin.");
      } else {
        toast.error(serverMsg || "Giriş yapılamadı. Bilgilerinizi kontrol edin.");
      }
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
