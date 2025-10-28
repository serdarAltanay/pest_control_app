import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerStoreDetail.scss";

let Recharts; try { Recharts = require("recharts"); } catch {}

const TYPE_TR = {
  FARE_YEMLEME: "Fare Yemleme",
  CANLI_YAKALAMA: "Canlı Yakalama",
  ELEKTRIKLI_SINEK_TUTUCU: "Elektrikli Sinek Tutucu",
  BOCEK_MONITOR: "Böcek Monitörü",
  GUVE_TUZAGI: "Güve Tuzağı",
};
const VISIT_TYPE_TR = {
  PERIYODIK: "Periyodik Ziyaret",
  ACIL_CAGRI: "Acil Çağrı",
  ISTASYON_KURULUM: "İstasyon Kurulum",
  ILK_ZIYARET: "İlk Ziyaret",
  DIGER: "Diğer",
};
const PIE_COLORS = ["#2563eb","#10b981","#f59e0b","#ef4444","#8b5cf6","#14b8a6","#f97316","#06b6d4","#84cc16","#e11d48"];

export default function CustomerStoreDetail() {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [metrics, setMetrics] = useState({});
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const fmtD = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");
  const fmtT = (a, b) => `${a || "—"} / ${b || "—"}`;

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const { data: s } = await api.get(`/stores/${storeId}`, { signal: ctrl.signal });
        setStore(s);
      } catch (e) {
        toast.error(e?.response?.data?.message || "Mağaza bilgisi alınamadı");
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [storeId]);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        let m = {};
        try {
          const { data } = await api.get(`/stations/metrics/store/${storeId}`, { signal: ctrl.signal });
          m = data;
        } catch {
          const { data } = await api.get(`/stores/${storeId}/stations/metrics`, { signal: ctrl.signal });
          m = data;
        }
        setMetrics(m || {});
      } catch {}
    })();
    return () => ctrl.abort();
  }, [storeId]);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        let list = [];
        try {
          const { data } = await api.get(`/visits/store/${storeId}`, { signal: ctrl.signal });
          list = data;
        } catch {
          const { data } = await api.get(`/stores/${storeId}/visits`, { signal: ctrl.signal });
          list = data;
        }
        list = Array.isArray(list)
          ? [...list].sort((a, b) => new Date(b.date) - new Date(a.date))
          : [];
        setVisits(list);
      } catch {}
    })();
    return () => ctrl.abort();
  }, [storeId]);

  const pieData = useMemo(
    () =>
      Object.entries(metrics)
        .map(([k, v]) => ({ name: TYPE_TR[k] || k, value: v }))
        .filter((d) => d.value > 0),
    [metrics]
  );

  return (
    <Layout title={store?.name || "Mağaza"}>
      <div className="cust-store-detail">
        <div className="head">
          <div className="title">
            <h1>{store?.name || "Mağaza"}</h1>
            <div className="sub">
              Bağlı Şirket: <b>{store?.customer?.title || "—"}</b>
            </div>
          </div>
          <div className="tabs">
            <Link className="tab" to={`/customer/stores/${storeId}/nonconformities`}>Uygunsuzluklar</Link>
            <Link className="tab" to={`/customer/files?storeId=${storeId}`}>Raporlar</Link>
          </div>
        </div>

        {loading ? (
          <section className="card">Yükleniyor…</section>
        ) : (
          <>
            <section className="card">
              <div className="card-title">Mağaza Bilgileri</div>
              <div className="kv">
                <div><b>Kod</b><span>{store?.code || "—"}</span></div>
                <div><b>Şehir</b><span>{store?.city || "—"}</span></div>
                <div><b>Telefon</b><span>{store?.phone || "—"}</span></div>
                <div className="full"><b>Adres</b><span>{store?.address || "—"}</span></div>
                <div><b>Durum</b><span className={`badge ${store?.isActive ? "ok":"no"}`}>{store?.isActive?"Aktif":"Pasif"}</span></div>
              </div>
            </section>

            <div className="grid">
              <section className="card">
                <div className="card-title">Son Ziyaretler</div>
                {visits.length === 0 ? (
                  <div className="empty">Henüz ziyaret yok.</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr><th>Tarih</th><th>Saat</th><th>Tür</th><th>Personel</th><th>EK-1</th></tr>
                    </thead>
                    <tbody>
                      {visits.map((v) => (
                        <tr key={v.id}>
                          <td>{fmtD(v.date)}</td>
                          <td>{fmtT(v.startTime, v.endTime)}</td>
                          <td>{VISIT_TYPE_TR[v.visitType] || v.visitType || "—"}</td>
                          <td>{
                            Array.isArray(v.employees)
                              ? v.employees.join(", ")
                              : (typeof v.employees === "string" ? v.employees : "—")
                          }</td>
                          <td>
                            <Link className="btn primary" to={`/ek1/visit/${v.id}`}>Önizle</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="card chart-card">
                <div className="card-title">Ekipman Dağılımı</div>
                {Recharts && pieData.length > 0 ? (
                  <Recharts.ResponsiveContainer width="100%" height={260}>
                    <Recharts.PieChart>
                      <Recharts.Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} label>
                        {pieData.map((_, i) => (
                          <Recharts.Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Recharts.Pie>
                      <Recharts.Tooltip />
                      <Recharts.Legend />
                    </Recharts.PieChart>
                  </Recharts.ResponsiveContainer>
                ) : (
                  <div className="empty">Grafik için veri yok.</div>
                )}
                <ul className="counts">
                  {Object.entries(metrics).map(([k, v]) => (
                    <li key={k}><b>{TYPE_TR[k] || k}:</b> {v}</li>
                  ))}
                  {Object.keys(metrics).length === 0 && <li>—</li>}
                </ul>
              </section>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
