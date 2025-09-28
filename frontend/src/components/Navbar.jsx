import "../styles/Navbar.scss";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js"; // axios instance
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Navbar() {
  const navigate = useNavigate();

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleLogoutClick = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");

      if (refreshToken) {
        await api.post("/auth/logout", { refreshToken });
      }

      // Kullanıcı bilgilerini temizle
      localStorage.removeItem("role");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("name");
      localStorage.removeItem("email");

      toast.success("Başarıyla çıkış yaptınız!");
      navigate("/");
    } catch (err) {
      console.error("Logout hatası:", err);
      localStorage.clear();
      toast.error("Çıkış sırasında bir hata oluştu, yönlendiriliyorsunuz...");
      navigate("/");
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">Pest Control</div>
      <div className="navbar-right">
        <button className="navbar-btn" onClick={handleProfileClick}>
          Profil
        </button>
        <button className="navbar-btn" onClick={handleLogoutClick}>
          Çıkış
        </button>
      </div>
    </nav>
  );
}
