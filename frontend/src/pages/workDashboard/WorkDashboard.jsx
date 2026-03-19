// src/pages/workDashboard/WorkDashboard.jsx
import { useState, useContext, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import "./WorkDashboard.scss";
import PresenceOverview from "../../components/PrecenceOverview";
import AdminStatsChart from "../../components/AdminStatsChart";
import { ProfileContext } from "../../context/ProfileContext";
import api from "../../api/axios";

// Icons
import { 
  FiUsers, 
  FiHome, 
  FiMapPin, 
  FiCalendar, 
  FiFileText, 
  FiClock, 
  FiCheckCircle, 
  FiAlertTriangle 
} from "react-icons/fi";

import DashCalToday, {
  DashCalNext3,
  DashCalFailedLast7,
  CompletedVisitsTable,
} from "../calendar/DashboardCalendar.jsx";

import Ek1List from "../ek1/Ek1List.jsx";

export default function WorkDashboard() {
  const navigate = useNavigate();
  const { profile } = useContext(ProfileContext);
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const isAdmin = role === "admin";

  const [showCustomerSection, setShowCustomerSection] = useState(true);
  const [stats, setStats] = useState({
    customers: 0,
    stores: 0,
    plannedVisits: 0,
    openNcr: 0
  });

  const displayName = profile?.fullName || profile?.name || "";

  // Dynamic greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Günaydın";
    if (hour < 18) return "İyi Günler";
    return "İyi Akşamlar";
  }, []);

  const fetchStats = async () => {
    try {
      // Backend handles partial stats in different endpoints, but let's try to get a quick overview
      const [presenceRes, visitRes] = await Promise.all([
        api.get("/presence/summary", { _silent: true }),
        api.get("/schedule/events", { 
          params: { 
            from: new Date().toISOString(), 
            to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() 
          }, 
          _silent: true 
        })
      ]);

      setStats({
        customers: presenceRes.data?.totals?.customers || 0,
        stores: presenceRes.data?.totals?.stores || 0,
        plannedVisits: visitRes.data?.length || 0,
        openNcr: 0 // Placeholder for now or fetch if endpoint exists
      });
    } catch (err) {
      console.error("Stats fetch error:", err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <Layout onCustomerClick={() => setShowCustomerSection(true)}>
      <div className="work-dashboard dashboard-container">
        <header className="dashboard-header">
          <div className="header-left">
            <span className="date-pill">{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</span>
            <h1>{greeting}, {displayName.split(' ')[0]} 👋</h1>
            <p className="sub-greeting">İşletmenizin bugünkü durumuna göz atın.</p>
          </div>
        </header>

        {/* --- Summary Cards --- */}
        <div className="summary-grid">
          <div className="stat-card clickable" onClick={() => navigate("/admin/customers")}>
            <div className="icon-box blue"><FiUsers /></div>
            <div className="stat-info">
              <span className="stat-label">Aktif Müşteri</span>
              <span className="stat-value">{stats.customers}</span>
            </div>
          </div>
          <div className="stat-card clickable" onClick={() => navigate("/admin/stores")}>
            <div className="icon-box green"><FiHome /></div>
            <div className="stat-info">
              <span className="stat-label">Toplam Mağaza</span>
              <span className="stat-value">{stats.stores}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="icon-box purple"><FiClock /></div>
            <div className="stat-info">
              <span className="stat-label">Haftalık Ziyaret</span>
              <span className="stat-value">{stats.plannedVisits}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="icon-box orange"><FiAlertTriangle /></div>
            <div className="stat-info">
              <span className="stat-label">Bekleyen Uygunsuzluk</span>
              <span className="stat-value">{stats.openNcr}</span>
            </div>
          </div>
        </div>

        {showCustomerSection && (
          <section className="customer-section">
            <div className="ps-grid">
              {/* --- Shortcuts --- */}
              <div className="ps-left">
                <div className="qa-card modern-shortcuts">
                  <div className="qa-head">
                    <h3>Hızlı İslemler</h3>
                    <p className="qa-sub">Sık kullanılan sayfalara anında erişin</p>
                  </div>

                  <div className="shortcut-grid">
                    <div className="short-item" onClick={() => navigate("/admin/customers")}>
                      <div className="short-icon"><FiUsers /></div>
                      <span>Müşteriler</span>
                    </div>
                    <div className="short-item" onClick={() => navigate("/admin/stores")}>
                      <div className="short-icon"><FiHome /></div>
                      <span>Mağazalar</span>
                    </div>
                    {isAdmin && (
                      <div className="short-item" onClick={() => navigate("/tracking/employees")}>
                        <div className="short-icon"><FiMapPin /></div>
                        <span>Takip</span>
                      </div>
                    )}
                    <div className="short-item highlighted" onClick={() => navigate("/ek1/serbest")}>
                      <div className="short-icon"><FiFileText /></div>
                      <span>Serbest EK-1</span>
                    </div>
                    <div className="short-item highlighted" style={{ borderColor: 'var(--success)' }} onClick={() => navigate("/ek1/hizli")}>
                      <div className="short-icon"><FiFileText /></div>
                      <span>EK-1 Doldur</span>
                    </div>
                    <div className="short-item" onClick={() => navigate("/calendar")}>
                      <div className="short-icon"><FiCalendar /></div>
                      <span>Takvim</span>
                    </div>
                    <div className="short-item" onClick={() => navigate("/admin/biocides")}>
                      <div className="short-icon"><FiCheckCircle /></div>
                      <span>Biyosidaller</span>
                    </div>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="ps-mid">
                  <AdminStatsChart />
                </div>
              )}

              <div className="ps-right">
                <PresenceOverview />
              </div>
            </div>
          </section>
        )}

        {/* --- Reporting & Tasks Rows --- */}
        <div className="dashboard-content-rows">
          
          {/* Row 1: EK-1 Full Width */}
          <section className="dashboard-row full-width">
            <header className="section-head">
              <h2>EK-1 Raporları</h2>
            </header>
            <div className="content-card">
              <Ek1List limit={5} />
            </div>
          </section>

          {/* Row 2: Completed + Today side-by-side */}
          <div className="dashboard-row split">
            <section className="row-column">
              <header className="section-head">
                <h2>Son Tamamlananlar</h2>
              </header>
              <div className="content-card">
                <CompletedVisitsTable limit={5} />
              </div>
            </section>
            <section className="row-column">
              <header className="section-head">
                <h2>Bugünün Ziyaretleri</h2>
              </header>
              <DashCalToday />
            </section>
          </div>

          {/* Row 3: Next 3 Days + Failed side-by-side */}
          <div className="dashboard-row split">
            <section className="row-column">
              <header className="section-head">
                <h2>Önümüzdeki 3 Gün</h2>
              </header>
              <DashCalNext3 />
            </section>
            <section className="row-column">
              <header className="section-head">
                <h2>Geçtiğimiz 7 Gün (Başarısız/Ertelenen)</h2>
              </header>
              <DashCalFailedLast7 />
            </section>
          </div>

        </div>
      </div>
    </Layout>
  );
}
