// src/pages/workDashboard/WorkDashboard.jsx
import { useState } from "react";
import Layout from "../../components/Layout";
import "./WorkDashboard.scss";
import api from "../../api/axios";
import { toast } from "react-toastify";
import PresenceOverview from "../../components/PrecenceOverview";

import DashCalToday, {
  DashCalNext3,
  DashCalFailedLast7,
  CompletedVisitsTable,
} from "../calendar/DashboardCalendar.jsx";


import Ek1List from "../ek1/Ek1List.jsx";

export default function WorkDashboard() {
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const [showCustomerSection, setShowCustomerSection] = useState(true);
  const [busy, setBusy] = useState(false);

  const runSeed = async () => {
    if (!window.confirm("Demo verilerini (admin/employee/customer) yüklemek istiyor musun?")) return;
    try {
      setBusy(true);
      await api.post("/seed/run");
      toast.success("Seed başarıyla çalıştı 🎉");
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || "Seed çalıştırılamadı");
    } finally {
      setBusy(false);
    }
  };

  const runWipe = async () => {
    if (!window.confirm("TÜM veriler silinecek. Emin misin?")) return;
    try {
      setBusy(true);
      const { data } = await api.post("/wipe");
      toast.success(data?.message || "Tüm veriler silindi 🧹");
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || "Silme başarısız");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout onCustomerClick={() => setShowCustomerSection(true)}>
      <div className="work-dashboard">
        <h1>İş Takip Paneli</h1>

        {role === "admin" && (
          <div className="admin-tools">
            <button className="seed-btn" onClick={runSeed} disabled={busy}>
              {busy ? "Çalışıyor..." : "Demo Verilerini Yükle (Seed)"}
            </button>
            <button className="wipe-btn" onClick={runWipe} disabled={busy}>
              {busy ? "Çalışıyor..." : "Tüm Verileri Sil (Wipe)"}
            </button>
          </div>
        )}

        {showCustomerSection && (
          <section className="customer-section">
            <h2>Müşteri İşleri</h2>
            <PresenceOverview />
            {role === "admin" && (
              <div className="admin-buttons">
                <p>Admin olarak buradan görev dağıtımı yapabilirsiniz.</p>
              </div>
            )}
            <p>
              Görevleri bu sayfadan yönetebilirsiniz. Müşteri ve mağaza ekleme ayrı sayfada olacak.
            </p>
          </section>
        )}
        <Ek1List/>
        <CompletedVisitsTable />

        {/* ───────── Ziyaret Özetleri (en aşağı) ───────── */}
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
