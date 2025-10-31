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

  const isAdmin = role === "admin";
  const isEmployee = role === "employee";
  const isCustomer = role === "customer";
  const canManageBasic = isAdmin || isEmployee; // müşteri/mağaza/biocide menüleri

  useEffect(() => {
    if (!isCustomer) return;
    (async () => {
      try {
        let arr = [];
        try {
          const { data } = await api.get("/customer/stores"); // tercih edilen
          arr = Array.isArray(data) ? data : [];
        } catch {
          // yedek uçlar
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
  }, [isCustomer]);

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
          {isCustomer && (
            <>
              <li className="section-title">Pest işlerim</li>
              <li className="sidebar-item" onClick={() => navigate("/customer")}>Anasayfa</li>
              <li className="sidebar-item" onClick={goMyStore}>{labelMyStore}</li>
              <li className="sidebar-item" onClick={() => navigate("/customer/agenda")}>Ziyaret Ajandam</li>
              <li className="sidebar-item" onClick={() => navigate("/customer/reports")}>Dosyalar/Raporlar</li>
              <li className="section-title">iletişim</li>
              {/* ⇩⇩ Yeni linkler (müşteri) ⇩⇩ */}
              <li className="sidebar-item" onClick={() => navigate("/customer/feedback/new")}>Şikayet / Öneri Oluştur</li>
              <li className="sidebar-item" onClick={() => navigate("/customer/feedback")}>Şikayet & Önerilerim</li>
              <li className="sidebar-item" onClick={() => navigate("/customer/contacts")}>İletişim Kanalları</li>
            </>
          )}

          {/* PERSONEL İŞLERİ (admin + employee) */}
          {(isEmployee || isAdmin) && (
            <>
              <li className="section-title">İşler</li>
              <li className="sidebar-item" onClick={() => navigate("/work")}>İş Paneli</li>
              <li className="sidebar-item" onClick={() => navigate("/ek1/serbest")}>Serbest Ek1 oluştur</li>
              <li className="sidebar-item" onClick={() => navigate("/calendar")}>Ziyaret Takvimi</li>
            </>
          )}

          {/* YÖNETİM — TEMEL (admin + employee görür) */}
          {canManageBasic && (
            <>
              <li className="section-title">Yönetim İşleri</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/customers/new")}>Müşteri Ekle</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/customers")}>Müşteri Listesi</li>
              {/* Mağaza ekleme menüsü eklendi */}
              <li className="sidebar-item" onClick={() => navigate("/admin/stores")}>Mağaza Listesi</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/biocides")}>Biyosidallar</li>
            </>
          )}

          {/* YÖNETİM — İLERİ (sadece admin) */}
          {isAdmin && (
            <>
              <li className="section-title">Personel İşleri</li>
              <li className="sidebar-item" onClick={() => navigate("/tracking/employees")}>Personel Takip</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/employees/new")}>Personel Ekle</li>

              <li className="section-title">Erişim İşleri</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/access")}>Erişim Listesi</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/access/new")}>Yeni Erişim Ver</li>

              <li className="section-title">İletişim</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/complaints")}>Şikayetler</li>
              <li className="sidebar-item" onClick={() => navigate("/admin/suggestions")}>Öneriler</li>
            </>
          )}
        </ul>
      )}
    </aside>
  );
}
