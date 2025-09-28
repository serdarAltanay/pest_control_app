import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Sidebar.scss";

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const role = localStorage.getItem("role");
  const navigate = useNavigate();

  return (
    <aside className={`sidebar ${open ? "open" : "closed"}`}>
      <button className="sidebar-toggle" onClick={() => setOpen(!open)}>☰</button>
      {open && (
        <ul className="sidebar-menu">
          {role === "customer" && (
            <>
              <li className="sidebar-item" onClick={() => navigate("/customer/stores")}>Mağazalarım</li>
              <li className="sidebar-item" onClick={() => navigate("/customer/files")}>Dosyalar</li>
            </>
          )}

          {(role === "employee" || role === "admin") && (
            <>
              <li className="sidebar-item" onClick={() => navigate("/work")}>İş Takibi</li>
              <li className="sidebar-item" onClick={() => navigate("/work/tasks")}>Görevler</li>
              <li className="sidebar-item" onClick={() => navigate("/work/reports")}>Raporlar</li>
            </>
          )}

          {role === "admin" && (
            <>
            <li className="sidebar-item" onClick={() => navigate("/customers")}>Müşteri İşleri</li>
            
            <li className="sidebar-item">
              <Link to="/admin">Kullanıcı Ekle/Çıkar</Link>
            </li>
            </>
          )}
        </ul>
      )}
    </aside>
  );
}
