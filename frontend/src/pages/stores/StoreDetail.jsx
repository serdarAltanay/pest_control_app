import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./StoreDetail.scss";

// recharts yoksa sayfa yine çalışsın diye dinamik require
let Recharts;
try { Recharts = require("recharts"); } catch {}

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
  "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#e11d48",
];

export default function StoreDetail() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [store, setStore] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [visits, setVisits] = useState([]);
  const [metrics, setMetrics] = useState({}); // {TYPE: count}

  // Mağaza + müşteri
  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await api.get(`/stores/${storeId}`);
        setStore(s);
        if (s.customerId) {
          try {
            const { data: c } = await api.get(`/customers/${s.customerId}`);
            setCustomer(c);
          } catch {}
        }
      } catch (e) {
        toast.error(e?.response?.data?.message || "Mağaza bilgisi alınamadı");
      }
    })();
  }, [storeId]);

  // Ziyaretler
  useEffect(() => {
    (async () => {
      try {
        let list = [];
        try {
          const { data } = await api.get(`/visits/store/${storeId}`);
          list = data;
        } catch {
          const { data } = await api.get(`/stores/${storeId}/visits`);
          list = data;
        }
        // güvenli sıralama (yeniden eskiye)
        list = Array.isArray(list) ? [...list].sort((a, b) => new Date(b.date) - new Date(a.date)) : [];
        setVisits(list);
      } catch {}
    })();
  }, [storeId]);

  // İstasyon metrikleri (grafik)
  useEffect(() => {
    (async () => {
      try {
        let m = {};
        try {
          const { data } = await api.get(`/stations/metrics/store/${storeId}`);
          m = data;
        } catch {
          const { data } = await api.get(`/stores/${storeId}/stations/metrics`);
          m = data;
        }
        setMetrics(m || {});
      } catch {}
    })();
  }, [storeId]);

  const pieData = useMemo(
    () =>
      Object.entries(metrics)
        .map(([k, v]) => ({ name: TYPE_TR[k] || k, value: v }))
        .filter((d) => d.value > 0),
    [metrics]
  );

  const fmtDate = (val) => {
    if (!val) return "—";
    try { return new Date(val).toLocaleDateString("tr-TR"); }
    catch { return String(val); }
  };

  const fmtTime = (start, end) => {
    const s = start || "—";
    const e = end || "—";
    return `${s} / ${e}`;
  };

  const handleDeleteStore = async () => {
    if (!store) return;
    if (!window.confirm("Bu mağazayı silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/stores/${storeId}`);
      toast.success("Mağaza silindi");
      if (store.customerId) navigate(`/admin/customers/${store.customerId}`);
      else navigate("/admin/customers");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Silinemedi");
    }
  };

  const hasCoords = store?.latitude != null && store?.longitude != null;
  const mapHref = hasCoords
    ? `https://www.google.com/maps?q=${store.latitude},${store.longitude}`
    : undefined;

  return (
    <Layout>
      <div className="store-detail-page">
        {/* ÜST BANT */}
        <div className="head">
          <div className="title">
            <h1>{store?.name || "Mağaza"}</h1>
            <div className="sub">
              Bağlı Şirket: <b>{customer?.title || "—"}</b>
            </div>
          </div>

          <div className="big-tabs">
            <Link to={`/admin/stores/${storeId}/ek1`} className="tab">EK-1 Rapor İşleri</Link>
            <Link to={`/admin/stores/${storeId}/stations`} className="tab">İstasyonlar</Link>
            <Link to={`/admin/stores/${storeId}/nonconformities`} className="tab">Uygunsuzluklar</Link>
            <Link to={`/admin/stores/${storeId}/activities`} className="tab">Aktivite Raporları</Link>
            <Link to={`/admin/stores/${storeId}/files`} className="tab">Dosyalar</Link>
          </div>
        </div>

        {/* ORTA: MAĞAZA BİLGİLERİ + AKSİYONLAR */}
        <div className="middle-grid">
          <section className="card info-card">
            <div className="card-title">
              <span>Mağaza Bilgileri</span>
              <div className="right-actions">
                {hasCoords ? (
                  <a className="btn ghost" href={mapHref} target="_blank" rel="noreferrer">Haritada Göster</a>
                ) : (
                  <button className="btn ghost" disabled title="Koordinat yok">Haritada Göster</button>
                )}
                <Link className="btn warn" to={`/admin/stores/${storeId}/edit`}>Düzenle</Link>
                <button className="btn danger" onClick={handleDeleteStore}>Sil</button>
              </div>
            </div>

            <div className="kv">
              <div><b>Kod</b><span>{store?.code || "—"}</span></div>
              <div><b>Şehir</b><span>{store?.city || "—"}</span></div>
              <div><b>Telefon</b><span>{store?.phone || "—"}</span></div>
              <div><b>Yetkili</b><span>{store?.manager || "—"}</span></div>
              <div className="full"><b>Adres</b><span>{store?.address || "—"}</span></div>
              <div>
                <b>Durum</b>
                <span>
                  <span className={`badge ${store?.isActive ? "ok" : "no"}`}>
                    {store?.isActive ? "Aktif" : "Pasif"}
                  </span>
                </span>
              </div>
              <div>
                <b>Koordinatlar</b>
                <span>
                  {hasCoords ? `${Number(store.latitude).toFixed(5)}, ${Number(store.longitude).toFixed(5)}` : "—"}
                </span>
              </div>
              <div><b>Oluşturulma</b><span>{fmtDate(store?.createdAt)}</span></div>
              <div><b>Güncelleme</b><span>{fmtDate(store?.updatedAt)}</span></div>
            </div>
          </section>
        </div>

        {/* ALT GRID */}
        <div className="grid">
          {/* SOL: ZİYARETLER */}
          <section className="card">
            <div className="card-title">
              Son Ziyaretler
              <Link className="btn primary" style={{ marginLeft: "auto" }} to={`/admin/stores/${storeId}/ek1`}>
                + Yeni Ziyaret (EK-1)
              </Link>
            </div>

            {visits.length === 0 ? (
              <div className="empty">Henüz ziyaret kaydı yok.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Saat</th>
                    <th>Firma</th>
                    <th>Ziyaret</th>
                    <th>İşlem Yapan</th>
                    <th>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id}>
                      <td className="date">{fmtDate(v.date)}</td>
                      <td>{fmtTime(v.startTime, v.endTime)}</td>
                      <td className="firm">{store?.name || "—"}</td>
                      <td className="type">{VISIT_TYPE_TR[v.visitType] || v.visitType || "—"}</td>
                      <td className="user">
                        {Array.isArray(v.employees)
                          ? v.employees.join(", ")
                          : (typeof v.employees === "string" ? v.employees : "—")}
                      </td>
                      <td className="row-actions">
                        <button className="btn">Mail</button>
                        <button className="btn warn">Gözlem</button>
                        <button className="btn danger">Sil</button>
                        <Link
                          className="btn primary"
                          to={`/admin/stores/${storeId}/visits/${v.id}/biocides`}
                          title="Ziyarete Biyosidal Ekle / EK-1"
                        >
                          EK-1
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* SAĞ: GRAFİK */}
          <section className="card chart-card">
            <div className="card-title right">
              Gözlem Ekipman Grafiği
              <button className="btn ghost small">Yazdır</button>
            </div>

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
                    {pieData.map((_, index) => (
                      <Recharts.Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
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
      </div>
    </Layout>
  );
}
