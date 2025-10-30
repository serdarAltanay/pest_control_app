// src/pages/customer/CustomerStoreDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerStoreDetail.scss";

/* ───────── Recharts (opsiyonel) ───────── */
let Recharts;
try { Recharts = require("recharts"); } catch {}

/* ───────── Sabitler ───────── */
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
const PIE_COLORS = [
  "#2563eb","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#14b8a6","#f97316","#06b6d4","#84cc16","#e11d48"
];

/* ───────── Yardımcılar ───────── */
const isAbort = (e) =>
  e?.name === "CanceledError" ||
  e?.code === "ERR_CANCELED" ||
  e?.message === "canceled" ||
  e?.__CANCEL__ === true;

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");
const fmtTimePair = (a, b) => `${a || "—"} / ${b || "—"}`;

const joinSafe = (arr, sep = ", ") =>
  (Array.isArray(arr) ? arr : [])
    .map((x) => (typeof x === "string" ? x : (x?.fullName || x?.name || x?.email || "")))
    .filter(Boolean)
    .join(sep);

function normalizeEmployees(e) {
  if (!e) return "—";
  if (typeof e === "string") return e;
  if (Array.isArray(e)) return joinSafe(e);
  if (typeof e === "object") {
    const list = e.names || e.list || e.employees || Object.values(e);
    return Array.isArray(list) ? joinSafe(list) : "—";
  }
  return "—";
}

/* ───────── Sayfa ───────── */
export default function CustomerStoreDetail() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [store, setStore] = useState(null);
  const [metrics, setMetrics] = useState({});
  const [visits, setVisits] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  /* Mağaza bilgisi */
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/stores/${storeId}`, { signal: ctrl.signal });
        setStore(data);
      } catch (e) {
        if (!isAbort(e)) {
          toast.error(e?.response?.data?.message || "Mağaza bilgisi alınamadı");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [storeId]);

  /* İstasyon metrikleri */
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
      } catch (e) {
        if (!isAbort(e)) console.warn("metrics fetch error:", e);
      }
    })();
    return () => ctrl.abort();
  }, [storeId]);

  /* Ziyaretler */
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
        if (!Array.isArray(list)) list = [];
        list.sort((a, b) => {
          const da = a?.date ? new Date(a.date).getTime() : 0;
          const db = b?.date ? new Date(b.date).getTime() : 0;
          return db - da;
        });
        setVisits(list);
      } catch (e) {
        if (!isAbort(e)) console.warn("visits fetch error:", e);
      }
    })();
    return () => ctrl.abort();
  }, [storeId]);

  /* İstasyonlar */
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        let list = [];
        try {
          const { data } = await api.get(`/stations/store/${storeId}`, { signal: ctrl.signal });
          list = data;
        } catch {
          const { data } = await api.get(`/stores/${storeId}/stations`, { signal: ctrl.signal });
          list = data;
        }
        setStations(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!isAbort(e)) console.warn("stations fetch error:", e);
      }
    })();
    return () => ctrl.abort();
  }, [storeId]);

  /* Pasta verisi */
  const pieData = useMemo(
    () =>
      Object.entries(metrics)
        .map(([k, v]) => ({ name: TYPE_TR[k] || k, value: v }))
        .filter((d) => (Number(d.value) || 0) > 0),
    [metrics]
  );

  /* Navigasyon yardımcıları */
  const goStation = (s) => navigate(`/customer/stations/${s.id}`);
  const goVisit = (v) => {
    const raw = v?.scheduleEventId ?? v?.eventId ?? v?.calendarEventId;
    const evId = Number(raw);
    if (Number.isFinite(evId)) return navigate(`/calendar/visit/${evId}`);
    return navigate(`/ek1/visit/${v.id}`);
  };

  return (
    <Layout title={store?.name || "Mağaza"}>
      <div className="cust-store-detail">
        {/* Başlık & sekmeler */}
        <div className="head">
          <div className="title">
            <h1>{store?.name || "Mağaza"}</h1>
            <div className="sub">
              Bağlı Şirket: <b>{store?.customer?.title || "—"}</b>
            </div>
          </div>
          <div className="tabs">
            <Link className="tab" to={`/customer/stores/${storeId}/nonconformities`}>Uygunsuzluklar</Link>
            <Link className="tab" to={`/customer/stores/${storeId}/reports`}>Raporlar</Link>
            <Link className="tab" to={`/customer/stores/${storeId}/analytics`}>Trend Analizi</Link>
          </div>
        </div>

        {/* İçerik */}
        {loading ? (
          <section className="card">Yükleniyor…</section>
        ) : (
          <>
            {/* Mağaza bilgisi */}
            <section className="card">
              <div className="card-title">Mağaza Bilgileri</div>
              <div className="kv">
                <div><b>Kod</b><span>{store?.code || "—"}</span></div>
                <div><b>Şehir</b><span>{store?.city || "—"}</span></div>
                <div><b>Telefon</b><span>{store?.phone || "—"}</span></div>
                <div className="full"><b>Adres</b><span>{store?.address || "—"}</span></div>
                <div>
                  <b>Durum</b>
                  <span className={`badge ${store?.isActive ? "ok":"no"}`}>
                    {store?.isActive ? "Aktif" : "Pasif"}
                  </span>
                </div>
              </div>
            </section>

            <div className="grid">
              {/* Son Ziyaretler */}
              <section className="card">
                <div className="card-title">Son Ziyaretler</div>
                {visits.length === 0 ? (
                  <div className="empty">Henüz ziyaret yok.</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tarih</th>
                        <th>Saat</th>
                        <th>Tür</th>
                        <th>Personel</th>
                        <th>EK-1</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits.map((v) => (
                        <tr
                          key={v.id}
                          className="click-row"
                          onClick={() => goVisit(v)}
                          title="Detayı görüntülemek için tıklayın"
                          style={{ cursor: "pointer" }}
                        >
                          <td>{fmtDate(v.date)}</td>
                          <td>{fmtTimePair(v.startTime, v.endTime)}</td>
                          <td>{VISIT_TYPE_TR[v.visitType] || v.visitType || "—"}</td>
                          <td>{normalizeEmployees(v.employees)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <Link className="btn primary" to={`/ek1/visit/${v.id}`}>Önizle</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* Ekipman dağılımı (opsiyonel grafik) */}
              <section className="card chart-card">
                <div className="card-title">Ekipman Dağılımı</div>
                {Recharts && pieData.length > 0 ? (
                  <Recharts.ResponsiveContainer width="100%" height={260}>
                    <Recharts.PieChart>
                      <Recharts.Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                        label
                      >
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

            {/* Kurulu İstasyonlar */}
            <section className="card">
              <div className="card-title">
                Kurulu İstasyonlar {stations.length ? `(${stations.length})` : ""}
              </div>

              {stations.length === 0 ? (
                <div className="empty">Bu mağazada henüz istasyon yok.</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Ad</th>
                      <th>Tür</th>
                      <th>Durum</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stations.map((s) => (
                      <tr
                        key={s.id}
                        className="click-row"
                        onClick={() => goStation(s)}
                        title="İstasyon detayına git"
                        style={{ cursor: "pointer" }}
                      >
                        <td>{s.code || "—"}</td>
                        <td className="strong">{s.name || "—"}</td>
                        <td>{TYPE_TR[s.type] || s.type || "—"}</td>
                        <td>
                          <span className={`badge ${s.isActive ? "ok" : "no"}`}>
                            {s.isActive ? "Aktif" : "Pasif"}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <Link className="btn primary" to={`/customer/stations/${s.id}`}>
                            Detay
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
