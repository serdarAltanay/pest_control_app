import "../styles/Navbar.scss";
import { useNavigate } from "react-router-dom";
import { useContext, useEffect, useRef, useState } from "react";
import { ProfileContext } from "../context/ProfileContext";
import { toast } from "react-toastify";
import api from "../api/axios";
import { getAvatarUrl } from "../utils/getAssetUrl";
import { useTheme } from "../context/ThemeContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { profile, setProfile } = useContext(ProfileContext);
  const { theme, setTheme } = useTheme();

  const rawAvatar = profile?.profileImage ?? localStorage.getItem("profileImage");
  const imgSrc = getAvatarUrl(rawAvatar) || localStorage.getItem("profileImage") || "/noavatar.jpg";

  const displayName =
    profile?.fullName || profile?.name || profile?.email?.split("@")[0] || "Kullanıcı";
  const displayRole = (profile?.role || profile?.userRole || "—")?.toString().toUpperCase();

  const [open, setOpen] = useState(false);
  const ddRef = useRef(null);
  useEffect(() => {
    const onClickOutside = (e) => { if (ddRef.current && !ddRef.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);

  const handleLogoutClick = async () => {
    try {
      await api.post("/auth/logout");
      localStorage.removeItem("profileImage");
      setProfile(null);
      localStorage.clear();
      toast.success("Başarıyla çıkış yaptınız!");
      navigate("/");
    } catch {
      toast.error("Çıkış yapılamadı ❌");
    }
  };

  const isDark = theme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  return (
    <nav className="navbar">
      <div className="navbar-left">Pest Control</div>

      <div className="navbar-right">
        {/* PROFIL DROPDOWN */}
        <div className="profile-dropdown" ref={ddRef}>
          <button className="profile-trigger" onClick={() => setOpen((v) => !v)}>
            <span className="avatar"><img src={imgSrc} alt="Profil" /></span>
            <span className="who">
              <span className="name">{displayName}</span>
              <span className="role">{displayRole}</span>
            </span>
            <svg className={`chev ${open ? "up" : ""}`} viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path d="M7 10l5 5 5-5H7z" fill="currentColor"/>
            </svg>
          </button>

          <div className={`menu ${open ? "open" : ""}`} role="menu">
            <div className="menu-head">
              <span className="mh-name">{displayName}</span>
              <span className="mh-role">{displayRole}</span>
            </div>

            <button className="item" onClick={() => { setOpen(false); navigate("/profile"); }}>Profilim</button>
            <button className="item" onClick={() => { setOpen(false); navigate("/settings"); }}>Ayarlar</button>

            <div className="sep" />

            {/* TEMA SATIRI — DROPDOWN İÇİNDE */}
            <div className="row">
              <span className="row-label">Karanlık Mod</span>
              <button
                className={`dm-toggle sm ${isDark ? "on" : ""}`}
                onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                aria-label="Tema değiştir"
                title={isDark ? "Aydınlık moda geç" : "Karanlık moda geç"}
              >
                <span className="track">
                  <span className="icon sun" aria-hidden>
                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zm10.48 0l1.79-1.79 1.79 1.79-1.79 1.79-1.79-1.79zM12 2v3M12 19v3M4.84 17.24l-1.79 1.79 1.79 1.79 1.79-1.79-1.79-1.79zM19.16 17.24l1.79 1.79-1.79 1.79-1.79-1.79 1.79-1.79zM2 12h3M19 12h3M12 6a6 6 0 100 12 6 6 0 000-12z"/></svg>
                  </span>
                  <span className="icon moon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M21 12.79A9 9 0 1111.21 3 7 7 0 1021 12.79z"/></svg>
                  </span>
                </span>
                <span className="thumb" />
              </button>
            </div>

            <div className="sep" />

            <button className="item danger" onClick={handleLogoutClick}>Çıkış</button>
          </div>
        </div>
      </div>
    </nav>
  );
}
