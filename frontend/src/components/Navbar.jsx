import "../styles/Navbar.scss";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  const handleProfileClick = () => {
    navigate("/profile");
  };

  const handleLogoutClick = () => {
    // Kullanıcı bilgilerini temizle
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("name");
    localStorage.removeItem("email");
    // Login sayfasına yönlendir
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        Pest Control
      </div>
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
