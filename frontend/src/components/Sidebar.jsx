import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Sidebar.scss";

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const role = (localStorage.getItem("role") || "").toLowerCase();

  return (
    <aside className={`sidebar ${open ? "open" : "closed"}`}>
      <button className="sidebar-toggle" onClick={() => setOpen(!open)}>☰</button>

      {open && (
        <ul className="sidebar-menu">
          {/* MÜŞTERİ İŞLERİ */}
          {role === "customer" && (
            <>
              <li className="section-title">Müşteri İşleri</li>
              <li className="sidebar-item" onClick={() => navigate("/customer/stores")}>Mağazalarım</li>
              <li className="sidebar-item" onClick={() => navigate("/customer/files")}>Dosyalar</li>
            </>
          )}

          {/* PERSONEL İŞLERİ */}
          {(role === "employee" || role === "admin") && (
            <>
              <li className="section-title">Personel İşleri</li>
              <li className="sidebar-item" onClick={() => navigate("/work")}>İş Takibi</li>
              <li className="sidebar-item" onClick={() => navigate("/work/tasks")}>Görevler</li>
              <li className="sidebar-item" onClick={() => navigate("/work/reports")}>Raporlar</li>
              <li className="sidebar-item" onClick={() => navigate("/calendar")}>
                Ziyaret Takvimi
              </li>
            </>
          )}

          {/* YÖNETİM İŞLERİ */}
          {role === "admin" && (
            <>
              <li className="section-title">Yönetim İşleri</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/customers/new")}>Müşteri Ekle</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/customers")}>Müşteri Listesi</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/stores")}>
                Mağaza Listesi
              </li>
              <li className="sidebar-item" onClick={() => navigate("/tracking/employees")}>Personel Takip</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/employees/new")}>Personel Ekle</li>
              <li className="sidebar-item">
                <Link to="/admin/admins/new">Admin Ekle</Link>
              </li>
              <li className="sidebar-item" onClick={() => navigate("/admin/biocides")}>
                Biyosidallar
              </li>
            </>
          )}
        </ul>
      )}
    </aside>
  );
}
