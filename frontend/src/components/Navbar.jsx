// src/components/Navbar.jsx
import "../styles/Navbar.scss";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { ProfileContext } from "../context/ProfileContext";
import { toast } from "react-toastify";
import api from "../api/axios";
import { getAvatarUrl } from "../utils/getAssetUrl";

export default function Navbar() {
  const navigate = useNavigate();
  const { profile, setProfile } = useContext(ProfileContext);

  // localStorage’da (relative) bir yol varsa onu; yoksa profilden geleni kullan.
  // getAvatarUrl -> absolute URL’yi üretir, yoksa /noavatar.jpg döner.
  const rawAvatar = profile?.profileImage ?? localStorage.getItem("profileImage");
  const imgSrc = getAvatarUrl(rawAvatar) || localStorage.getItem("profileImage") || "/noavatar.jpg"; // cache-bust, yeni yüklenen avatar hemen görünsün

  const handleProfileClick = () => navigate("/profile");

  const handleLogoutClick = async () => {
    try {
      await api.post("/auth/logout");
      localStorage.removeItem("profileImage");
      setProfile(null);
      localStorage.clear();
      toast.success("Başarıyla çıkış yaptınız!");
      navigate("/");
    } catch (err) {
      console.error("Logout hatası:", err);
      toast.error("Çıkış yapılamadı ❌");
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">Pest Control</div>

      <div className="navbar-right">
        <button className="navbar-btn" onClick={handleProfileClick}>
          <span className="avatar-wrap">
            <img
              src={imgSrc}
              alt="Profil"
              className="navbar-profile-img"
              width={32}
              height={32}
              style={{ width: 32, height: 32, objectFit: "cover" }}
            />
          </span>
          Profil
        </button>

        <button className="navbar-btn" onClick={handleLogoutClick}>
          Çıkış
        </button>
      </div>
    </nav>
  );
}
