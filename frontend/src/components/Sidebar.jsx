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
              <li className="sidebar-item" onClick={() => navigate("/admin/customers/new")}>Müşteri Ekle</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/employees/new")}>Personel Ekle</li>
              <li className="sidebar-item">
                <Link to="/admin/admins/new">Admin Ekle</Link>
              </li>
            </>
          )}
        </ul>
      )}
    </aside>
  );
}
