// src/components/PresenceOverview.jsx
import { useEffect, useState } from "react";
import api from "../api/axios";
import "../styles/PrecenceOverview.scss";

export default function PresenceOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await api.get("/presence/summary");
      setData(res.data || null);
    } catch {
      // sessiz geçebiliriz; dashboard’da kritik değil
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    const id = setInterval(fetchSummary, 30000);
    return () => clearInterval(id);
  }, []);

  const Card = ({ title, bucket }) => (
    <div className="presence-card">
      <div className="title">{title}</div>
      <div className="stats">
        <span className="pill online">● {bucket?.online ?? 0}</span>
        <span className="pill idle">● {bucket?.idle ?? 0}</span>
        <span className="pill offline">● {bucket?.offline ?? 0}</span>
        <span className="total">{bucket?.total ?? 0} toplam</span>
      </div>
    </div>
  );

  const TotalsCard = ({ totals }) => (
    <div className="presence-card total-card">
      <div className="title">Sistem Toplamları</div>
      <div className="totals">
        <div className="tile">
          <div className="k">Müşteri</div>
          <div className="v">{totals?.customers ?? 0}</div>
        </div>
        <div className="tile">
          <div className="k">Mağaza</div>
          <div className="v">{totals?.stores ?? 0}</div>
        </div>
      </div>
    </div>
  );

  // customers: backend’de accessOwners alias’ı ile de geliyor → öncelik accessOwners
  const customersBucket = data?.accessOwners || data?.customers;

  return (
    <div className={`presence-overview ${loading ? "is-loading" : ""}`}>
      <div className="header">
        <h3>Çevrimiçi Durum Özeti</h3>
        <button onClick={fetchSummary} disabled={loading}>
          {loading ? "Yükleniyor..." : "Yenile"}
        </button>
      </div>

      <div className="grid">
        <Card title="Yöneticiler" bucket={data?.admins} />
        <Card title="Personeller" bucket={data?.employees} />
        <Card title="Müşteriler"  bucket={customersBucket} />
        <TotalsCard totals={data?.totals} />
      </div>

      {data?.updatedAt && (
        <div className="updated-at">
          Güncellendi: {new Date(data.updatedAt).toLocaleTimeString("tr-TR")}
        </div>
      )}
    </div>
  );
}
