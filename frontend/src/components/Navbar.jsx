import "../styles/Navbar.scss";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { ProfileContext } from "../context/ProfileContext";
import { toast } from "react-toastify";
import api from "../api/axios";
export default function Navbar() {
  const navigate = useNavigate();
  const { profile } = useContext(ProfileContext);

  // Tek isim: profileImage
  const imgSrc = profile?.profileImage || localStorage.getItem("profileImage") || "/noavatar.jpg";

  const handleProfileClick = () => navigate("/profile");

  const handleLogoutClick = async () => {
    try {
      // Backend'e logout isteği at (cookie silinsin)
      await api.post("/auth/logout");

      // Local storage temizle
      localStorage.clear();

      toast.success("Başarıyla Çıkış yaptınız!");
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
