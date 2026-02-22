// src/pages/workDashboard/WorkDashboard.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import "./WorkDashboard.scss";
import PresenceOverview from "../../components/PrecenceOverview";

import DashCalToday, {
  DashCalNext3,
  DashCalFailedLast7,
  CompletedVisitsTable,
} from "../calendar/DashboardCalendar.jsx";

import Ek1List from "../ek1/Ek1List.jsx";

export default function WorkDashboard() {
  const navigate = useNavigate();
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const isAdmin = role === "admin";

  const [showCustomerSection, setShowCustomerSection] = useState(true);


  return (
    <Layout onCustomerClick={() => setShowCustomerSection(true)}>
      <div className="work-dashboard">
        <h1>İş Takip Paneli</h1>


        {showCustomerSection && (
          <section className="customer-section">
            <h2>Müşteri İşleri</h2>

            {/* SOL: Kısayollar — SAĞ: PresenceOverview */}
            <div className="ps-grid">
              <div className="ps-left">
                <div className="qa-card">
                  <div className="qa-head">
                    <h3>Kısayollar</h3>
                    <p className="qa-sub">Sık kullanılan sayfalara hızlı erişim</p>
                  </div>

                  <div className="qa-actions">
                    <button className="qa-btn" onClick={() => navigate("/admin/customers")}>
                      Müşteri Listesi
                    </button>

                    <button className="qa-btn" onClick={() => navigate("/admin/stores")}>
                      Mağaza Listesi
                    </button>

                    {/* Personel Takip: sadece admin görsün */}
                    {isAdmin && (
                      <button className="qa-btn" onClick={() => navigate("/tracking/employees")}>
                        Personel Takip
                      </button>
                    )}

                    <button className="qa-btn" onClick={() => navigate("/ek1/serbest")}>
                      Serbest EK-1 Oluştur
                    </button>

                    <button className="qa-btn" onClick={() => navigate("/calendar")}>
                      Ziyaret Takvimi
                    </button>
                  </div>
                </div>
              </div>

              <div className="ps-right">
                <PresenceOverview />
              </div>
            </div>

            {isAdmin && (
              <div className="admin-buttons">
                <p>Admin olarak buradan görev dağıtımı yapabilirsiniz.</p>
              </div>
            )}
          </section>
        )}

        {/* EK-1 ve tamamlanan ziyaretler */}
        <div className="ek1-wrap">
          <Ek1List />
        </div>
        <CompletedVisitsTable />

        {/* ───────── Ziyaret Özetleri ───────── */}
        <section className="calendar-section">
          <h2>Ziyaret Özetleri</h2>
          <div className="dash-grid">
            <DashCalToday />
            <DashCalNext3 />
            <DashCalFailedLast7 />
          </div>
        </section>
      </div>
    </Layout>
  );
}
