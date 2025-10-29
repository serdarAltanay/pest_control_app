// src/components/Sidebar.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Sidebar.scss";
import api from "../api/axios";

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [myStores, setMyStores] = useState(null); // null=yükleniyor, []=yok
  const navigate = useNavigate();
  const role = (localStorage.getItem("role") || "").toLowerCase();

  useEffect(() => {
    if (role !== "customer") return;
    (async () => {
      try {
        let arr = [];
        try {
          const { data } = await api.get("/customer/stores"); // tercih edilen
          arr = Array.isArray(data) ? data : [];
        } catch {
          // yedek uçlar: backend hangi isimdeyse ona döner
          try {
            const { data } = await api.get("/stores/mine");
            arr = Array.isArray(data) ? data : [];
          } catch {
            const { data } = await api.get("/stores?scope=self");
            arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
          }
        }
        setMyStores(arr);
      } catch {
        setMyStores([]);
      }
    })();
  }, [role]);

  const goMyStore = () => {
    if (!myStores || myStores.length === 0) {
      navigate("/customer/stores");
    } else if (myStores.length === 1) {
      const id = myStores[0]?.id || myStores[0]?.storeId;
      navigate(id ? `/customer/stores/${id}` : "/customer/stores");
    } else {
      navigate("/customer/stores");
    }
  };
  const labelMyStore =
    myStores == null ? "Mağaza…" : (myStores.length === 1 ? "Mağazam" : "Mağazalarım");

  return (
    <aside className={`sidebar ${open ? "open" : "closed"}`}>
      <button className="sidebar-toggle" onClick={() => setOpen(!open)}>☰</button>

      {open && (
        <ul className="sidebar-menu">
          {/* MÜŞTERİ İŞLERİ */}
          {role === "customer" && (
            <>
              <li className="section-title">Müşteri</li>
              <li className="sidebar-item" onClick={() => navigate("/customer")}>Anasayfa</li>
              <li className="sidebar-item" onClick={goMyStore}>{labelMyStore}</li>
              <li className="sidebar-item" onClick={() => navigate("/customer/files")}>Dosyalar</li>
            </>
          )}

          {/* PERSONEL İŞLERİ (App.js ile uyumlu) */}
          {(role === "employee" || role === "admin") && (
            <>
              <li className="section-title">İşler</li>
              <li className="sidebar-item" onClick={() => navigate("/work")}>İş Paneli</li>
              <li className="sidebar-item" onClick={() => navigate("/ek1/serbest")}>Serbest Ek1 oluştur</li>
              <li className="sidebar-item" onClick={() => navigate("/calendar")}>Ziyaret Takvimi</li>
            </>
          )}

          {/* YÖNETİM İŞLERİ */}
          {role === "admin" && (
            <>
              <li className="section-title">Yönetim İşleri</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/customers/new")}>Müşteri Ekle</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/customers")}>Müşteri Listesi</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/stores")}>Mağaza Listesi</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/admins/new")}>Admin Ekle</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/biocides")}>Biyosidallar</li>
              <li className="section-title">Personel İşleri</li>
              <li className="sidebar-item" onClick={() => navigate("/tracking/employees")}>Personel Takip</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/employees/new")}>Personel Ekle</li>
              <li className="section-title">Erişim İşleri</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/access")}>Erişim Listesi</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/access/new")}>Yeni Erişim Ver</li>
            </>
          )}
        </ul>
      )}
    </aside>
  );
}
