import { useState } from "react";
import "../styles/Sidebar.scss";

export default function Sidebar({ onCustomerClick }) {
  const [open, setOpen] = useState(false);

  return (
    <aside className={`sidebar ${open ? "open" : "closed"}`}>
      <button className="sidebar-toggle" onClick={() => setOpen(!open)}>
        ☰
      </button>
      {open && (
        <ul className="sidebar-menu">
          <li className="sidebar-item" onClick={onCustomerClick}>Müşteri İşleri</li>
          <li className="sidebar-item">Dashboard</li>
          <li className="sidebar-item">Görevler</li>
          <li className="sidebar-item">Raporlar</li>
          <li className="sidebar-item">Ayarlar</li>
        </ul>
      )}
    </aside>
  );
}

