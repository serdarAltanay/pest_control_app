import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/Sidebar.scss";
import api from "../api/axios";
import useAuth from "../hooks/useAuth";

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const [open, setOpen] = useState(false);
  const [myStores, setMyStores] = useState(null); // null=yükleniyor, []=yok
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isEmployee = user?.role === "employee";
  const isCustomer = user?.role === "customer";
  const isLevel1 = isEmployee && user?.level === 1;
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
    <aside className={`sidebar ${open ? "open" : "closed"} ${mobileOpen ? "mobile-open" : ""}`}>
      <button className="sidebar-toggle" onClick={() => setOpen(!open)}>☰</button>

      {(open || mobileOpen) && (
        <ul className="sidebar-menu" onClick={() => { if (window.innerWidth < 768 && onMobileClose) onMobileClose(); }}>
          {/* MÜŞTERİ İŞLERİ */}
          {isCustomer && (
            <>
              <li className="section-title">Pest işlerim</li>
              <li className={`sidebar-item ${location.pathname === "/customer" ? "active" : ""}`} onClick={() => navigate("/customer")}>Anasayfa</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/customer/stores") ? "active" : ""}`} onClick={goMyStore}>{labelMyStore}</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/customer/agenda") ? "active" : ""}`} onClick={() => navigate("/customer/agenda")}>Ziyaret Ajandam</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/customer/reports") ? "active" : ""}`} onClick={() => navigate("/customer/reports")}>Dosyalar/Raporlar</li>
              <li className="section-title">iletişim</li>
              <li className={`sidebar-item ${location.pathname === "/customer/feedback/new" ? "active" : ""}`} onClick={() => navigate("/customer/feedback/new")}>Şikayet / Öneri Oluştur</li>
              <li className={`sidebar-item ${location.pathname === "/customer/feedback" ? "active" : ""}`} onClick={() => navigate("/customer/feedback")}>Şikayet & Önerilerim</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/customer/contacts") ? "active" : ""}`} onClick={() => navigate("/customer/contacts")}>İletişim Kanalları</li>
            </>
          )}

          {/* PERSONEL İŞLERİ (admin + employee) */}
          {(isEmployee || isAdmin) && (
            <>
              <li className="section-title">İşler</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/work") ? "active" : ""}`} onClick={() => navigate("/work")}>İş Paneli</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/ek1/serbest") ? "active" : ""}`} onClick={() => navigate("/ek1/serbest")}>Serbest Ek1 oluştur</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/ek1/hizli") ? "active" : ""}`} onClick={() => navigate("/ek1/hizli")}>Hızlı Ek1 doldur</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/calendar") ? "active" : ""}`} onClick={() => navigate("/calendar")}>Ziyaret Takvimi</li>
            </>
          )}

          {/* YÖNETİM — TEMEL (admin + employee görür) */}
          {canManageBasic && (
            <>
              <li className="section-title">Yönetim İşleri</li>
              {(isAdmin || isLevel1) && (
                <li className={`sidebar-item ${location.pathname === "/admin/customers/new" ? "active" : ""}`} onClick={() => navigate("/admin/customers/new")}>Müşteri Ekle</li>
              )}
              <li className={`sidebar-item ${location.pathname === "/admin/customers" ? "active" : ""}`} onClick={() => navigate("/admin/customers")}>Müşteri Listesi</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/admin/stores") ? "active" : ""}`} onClick={() => navigate("/admin/stores")}>Mağaza Listesi</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/admin/biocides") ? "active" : ""}`} onClick={() => navigate("/admin/biocides")}>Biyosidallar</li>
            </>
          )}

          {/* YÖNETİM — İLERİ (sadece admin) */}
          {isAdmin && (
            <>
              <li className="section-title">Personel İşleri</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/tracking/employees") ? "active" : ""}`} onClick={() => navigate("/tracking/employees")}>Personel Takip</li>
              <li className={`sidebar-item ${location.pathname === "/admin/employees/new" ? "active" : ""}`} onClick={() => navigate("/admin/employees/new")}>Personel Ekle</li>

              <li className="section-title">Erişim İşleri</li>
              <li className={`sidebar-item ${location.pathname === "/admin/access" ? "active" : ""}`} onClick={() => navigate("/admin/access")}>Erişim Listesi</li>
              <li className={`sidebar-item ${location.pathname === "/admin/access/new" ? "active" : ""}`} onClick={() => navigate("/admin/access/new")}>Yeni Erişim Ver</li>

              <li className="section-title">İletişim</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/admin/complaints") ? "active" : ""}`} onClick={() => navigate("/admin/complaints")}>Şikayetler</li>
              <li className={`sidebar-item ${location.pathname.startsWith("/admin/suggestions") ? "active" : ""}`} onClick={() => navigate("/admin/suggestions")}>Öneriler</li>

            </>
          )}

          {/* TÜM ROL VE KULLANICILAR İÇİN (Sertifikalar) - Personel erişemez */}
          {!isEmployee && (
            <>
              <li className="section-title">Sertifikalar</li>
              <li className={`sidebar-item ${location.pathname === "/certificates" ? "active" : ""}`} onClick={() => navigate("/certificates")}>Şirket Sertifikaları</li>
              <li className={`sidebar-item ${location.pathname === "/biocidal-certificates" ? "active" : ""}`} onClick={() => navigate("/biocidal-certificates")}>SDS İlaç Güvenlik Formları</li>
            </>
          )}

          {/* ARAÇLAR — EN ALTA ALINDI */}
          {isAdmin && (
            <>
              <li className="section-title">Araçlar</li>
              <li className={`sidebar-item ${location.pathname === "/tools/ek1-batch-print" ? "active" : ""}`} onClick={() => navigate("/tools/ek1-batch-print")}>Toplu Ek-1 Yazdır</li>
            </>
          )}

        </ul>
      )}
    </aside>
  );
}
